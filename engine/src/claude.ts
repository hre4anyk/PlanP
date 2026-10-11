import Anthropic from "@anthropic-ai/sdk";
import { Agent, type AgentRequest } from "anbaric";

// A Claude client for Anbaric agents with the knobs the built-in AnthropicAgent doesn't expose:
// low effort (fast enough for a live voice conversation) and structured JSON output.
export const COACH_MODEL = "claude-opus-5-5";

export class ClaudeClient extends Agent.Client {
  private client: Anthropic;
  constructor(apiKey: string) {
    super();
    this.client = new Anthropic({ apiKey });
  }

  async generate(request: AgentRequest): Promise<Record<string, unknown>> {
    const system = request.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const messages = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    const response = await this.client.messages.create({
      model: COACH_MODEL,
      max_tokens: 2000,
      system,
      messages: messages.length ? messages : [{ role: "user", content: "Go." }],
      output_config: { effort: "low", format: { type: "json_schema", schema: request.outputSchema as Record<string, unknown> } },
    });
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return JSON.parse(text);
  }
}
