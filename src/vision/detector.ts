import type { Box } from "@/logic/seats";
import type { WorkerRequest, WorkerResponse } from "./detector-worker";

export type Frame = { seats: Box[]; people: Box[]; timestamp: number; inferenceMs: number };
export type Delegate = "GPU" | "CPU";

const START_TIMEOUT_MS = 30_000;

/**
 * The on-device detector, running in a Web Worker. Only one frame is ever in flight:
 * if detection is slower than the camera, old frames are skipped instead of queueing lag.
 */
export class Detector {
  private worker: Worker;
  private busy = false;
  private lastVideoTime = -1;
  delegate: Delegate = "GPU";
  onFrame: (frame: Frame) => void = () => {};
  onError: (message: string) => void = () => {};

  private constructor(worker: Worker) {
    this.worker = worker;
  }

  static async start(): Promise<Detector> {
    const worker = new Worker(new URL("./detector-worker.ts", import.meta.url), { type: "module" });
    const detector = new Detector(worker);
    detector.delegate = await new Promise<Delegate>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("The detector took too long to start. Check the connection and try again.")), START_TIMEOUT_MS);
      worker.onerror = (e) => {
        clearTimeout(timeout);
        reject(new Error(e.message || "The detector could not start."));
      };
      worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
        if (data.type === "ready") {
          clearTimeout(timeout);
          resolve(data.delegate);
        } else if (data.type === "error") {
          clearTimeout(timeout);
          reject(new Error(data.message));
        }
      };
      worker.postMessage({ type: "init", origin: location.origin } satisfies WorkerRequest);
    }).catch((e) => {
      worker.terminate();
      throw e;
    });

    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      detector.busy = false;
      if (data.type === "result") detector.onFrame(data);
      else if (data.type === "error") detector.onError(data.message);
    };
    worker.onerror = (e) => detector.onError(e.message || "The detector stopped.");
    return detector;
  }

  /** Send the current video frame if the worker is free and the frame is new. */
  push(video: HTMLVideoElement) {
    if (this.busy || video.readyState < 2 || video.currentTime === this.lastVideoTime) return;
    this.busy = true;
    this.lastVideoTime = video.currentTime;
    const timestamp = performance.now();
    createImageBitmap(video)
      .then((bitmap) => this.worker.postMessage({ type: "frame", bitmap, timestamp } satisfies WorkerRequest, [bitmap]))
      .catch(() => {
        this.busy = false;
      });
  }

  stop() {
    this.worker.terminate();
  }
}
