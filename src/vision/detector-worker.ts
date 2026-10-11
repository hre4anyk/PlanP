/// <reference lib="webworker" />
// Runs the on-device detector off the main thread, so the camera view stays smooth on phones.
// Pattern from a motion game that ships on iPhones: one frame in flight, GPU first, CPU fallback.
import { FilesetResolver, ObjectDetector } from "@mediapipe/tasks-vision";

export type WorkerBox = { x: number; y: number; w: number; h: number };
export type WorkerRequest = { type: "init"; origin: string } | { type: "frame"; bitmap: ImageBitmap; timestamp: number };
export type WorkerResponse =
  | { type: "ready"; delegate: "GPU" | "CPU" }
  | { type: "result"; seats: WorkerBox[]; people: WorkerBox[]; vehicles: WorkerBox[]; timestamp: number; inferenceMs: number }
  | { type: "error"; message: string };

const SEAT_LABELS = new Set(["chair", "couch", "bench"]);
const VEHICLE_LABELS = new Set(["car", "truck", "bus", "motorcycle"]);
let detector: ObjectDetector | null = null;

const post = (message: WorkerResponse) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(message);

async function init(origin: string) {
  // Served from public/ by scripts/mediapipe-assets.mjs (ARCHITECTURE §4).
  // Classic (non-module) runtime: the bundled worker loads it with importScripts.
  const files = await FilesetResolver.forVisionTasks(`${origin}/mediapipe/wasm`);
  const options = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: `${origin}/mediapipe/efficientdet_lite0.tflite`, delegate },
    runningMode: "VIDEO" as const,
    scoreThreshold: 0.25,
    maxResults: 40,
    categoryAllowlist: ["chair", "couch", "bench", "person", "car", "truck", "bus", "motorcycle"],
  });
  try {
    detector = await ObjectDetector.createFromOptions(files, options("GPU"));
    post({ type: "ready", delegate: "GPU" });
  } catch {
    // A failed GPU start leaves the loaded runtime unusable; load a fresh copy for the CPU.
    files.wasmLoaderPath += `?fallback=${Date.now()}`;
    detector = await ObjectDetector.createFromOptions(files, options("CPU"));
    post({ type: "ready", delegate: "CPU" });
  }
}

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  if (data.type === "init") {
    try {
      await init(data.origin);
    } catch (e) {
      post({ type: "error", message: e instanceof Error ? e.message : String(e) });
    }
    return;
  }
  const { bitmap, timestamp } = data;
  try {
    if (!detector) return;
    const started = performance.now();
    const { width: w, height: h } = bitmap;
    const seats: WorkerBox[] = [];
    const people: WorkerBox[] = [];
    const vehicles: WorkerBox[] = [];
    for (const d of detector.detectForVideo(bitmap, timestamp).detections) {
      const b = d.boundingBox;
      const label = d.categories[0]?.categoryName;
      if (!b || !label) continue;
      const box = { x: b.originX / w, y: b.originY / h, w: b.width / w, h: b.height / h };
      if (label === "person") people.push(box);
      else if (SEAT_LABELS.has(label)) seats.push(box);
      else if (VEHICLE_LABELS.has(label)) vehicles.push(box);
    }
    post({ type: "result", seats, people, vehicles, timestamp, inferenceMs: performance.now() - started });
  } catch (e) {
    post({ type: "error", message: e instanceof Error ? e.message : String(e) });
  } finally {
    bitmap.close();
  }
};
