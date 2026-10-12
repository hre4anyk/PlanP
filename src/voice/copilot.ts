// S3: the voice copilot in the browser. OpenAI Realtime over WebRTC (speech in, speech out);
// tool calls arrive on the data channel and run against the page (route, parking, Claude research).

export type CopilotState = "off" | "connecting" | "live" | "working" | "error";
export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

type Handlers = {
  onState: (state: CopilotState, detail?: string) => void;
  onTranscript: (who: "you" | "copilot", text: string) => void;
  tools: Record<string, ToolHandler>;
};

type ServerEvent = {
  type: string;
  transcript?: string;
  error?: { message?: string };
  response?: { output?: { type: string; name?: string; arguments?: string; call_id?: string }[] };
};

export class VoiceCopilot {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private mic: MediaStream | null = null;
  private handlers: Handlers;
  /** A response is being generated; app updates wait for it to finish (OpenAI allows one at a time). */
  private responding = false;
  private queue: string[] = [];

  constructor(handlers: Handlers) {
    this.handlers = handlers;
  }

  /** Call from a tap: iPhone only allows the mic and audio playback after one. */
  async start(audio: HTMLAudioElement) {
    this.handlers.onState("connecting");
    try {
      const res = await fetch("/api/voice-key", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const pc = new RTCPeerConnection();
      this.pc = pc;
      pc.ontrack = (e) => {
        audio.srcObject = e.streams[0];
        void audio.play().catch(() => {});
      };
      this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      this.mic.getTracks().forEach((t) => pc.addTrack(t, this.mic!));

      const dc = pc.createDataChannel("oai-events");
      this.dc = dc;
      dc.onmessage = (e) => void this.onEvent(JSON.parse(e.data) as ServerEvent);
      dc.onopen = () => {
        this.handlers.onState("live");
        this.respond(); // the copilot greets first
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const answer = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: { Authorization: `Bearer ${data.key}`, "Content-Type": "application/sdp" },
      });
      if (!answer.ok) throw new Error("The voice service didn't answer");
      await pc.setRemoteDescription({ type: "answer", sdp: await answer.text() });
    } catch (e) {
      this.stop();
      const message =
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone blocked. On iPhone: aA → Website Settings → Microphone → Allow."
          : e instanceof Error
            ? e.message
            : "Couldn't start the copilot";
      this.handlers.onState("error", message);
    }
  }

  /** Tell the copilot something from the app (parking ahead, arrival) so it can say it. */
  say(text: string) {
    if (this.dc?.readyState !== "open") return;
    if (this.responding) {
      // Keep only the latest few updates; stale parking news isn't worth saying.
      this.queue = [...this.queue.slice(-1), text];
      return;
    }
    this.sendUpdate(text);
  }

  private sendUpdate(text: string) {
    this.send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
    this.respond();
  }

  private respond() {
    this.responding = true;
    this.send({ type: "response.create" });
  }

  /** Mic off: the track sends silence, so room noise can't interrupt her. She keeps talking. */
  setMuted(muted: boolean) {
    this.mic?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }

  get live() {
    return this.dc?.readyState === "open";
  }

  stop() {
    this.dc?.close();
    this.pc?.close();
    this.mic?.getTracks().forEach((t) => t.stop());
    this.dc = null;
    this.pc = null;
    this.mic = null;
    this.handlers.onState("off");
  }

  private send(event: Record<string, unknown>) {
    if (this.dc?.readyState === "open") this.dc.send(JSON.stringify(event));
  }

  private async onEvent(event: ServerEvent) {
    switch (event.type) {
      case "response.created":
        this.responding = true;
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (event.transcript?.trim()) this.handlers.onTranscript("you", event.transcript.trim());
        break;
      case "response.output_audio_transcript.done":
        if (event.transcript?.trim()) this.handlers.onTranscript("copilot", event.transcript.trim());
        break;
      case "response.done": {
        this.responding = false;
        const calls = (event.response?.output ?? []).filter((o) => o.type === "function_call" && o.name && o.call_id);
        if (!calls.length) {
          const next = this.queue.shift();
          if (next) this.sendUpdate(next);
          break;
        }
        this.handlers.onState("working", calls.map((c) => c.name).join(", "));
        for (const call of calls) {
          let output: string;
          try {
            const handler = this.handlers.tools[call.name!];
            output = handler ? await handler(JSON.parse(call.arguments || "{}")) : `Unknown tool ${call.name}`;
          } catch (e) {
            output = `That didn't work: ${e instanceof Error ? e.message : "error"}`;
          }
          this.send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: call.call_id, output } });
        }
        this.handlers.onState("live");
        this.respond();
        break;
      }
      case "error":
        // Non-fatal (e.g. a cancelled response); keep the session going.
        console.warn("copilot:", event.error?.message);
        break;
    }
  }
}
