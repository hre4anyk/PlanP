import type { ObjectDetector } from "@mediapipe/tasks-vision";
import type { Box } from "@/logic/seats";

// Served from public/ by scripts/mediapipe-assets.mjs (ARCHITECTURE §4).
const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/efficientdet_lite0.tflite";
const SEAT_LABELS = new Set(["chair", "couch", "bench"]);

export type Frame = { seats: Box[]; people: Box[] };

/** Load the on-device detector once. Tries the GPU first, then the CPU (older iPhones, some browsers). */
export async function loadDetector(): Promise<ObjectDetector> {
  const { FilesetResolver, ObjectDetector } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  const options = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: "VIDEO" as const,
    scoreThreshold: 0.25,
    maxResults: 40,
    categoryAllowlist: ["chair", "couch", "bench", "person"],
  });
  try {
    return await ObjectDetector.createFromOptions(fileset, options("GPU"));
  } catch {
    return await ObjectDetector.createFromOptions(fileset, options("CPU"));
  }
}

/** Run the detector on the current video frame; boxes come back normalised to 0–1. */
export function detectFrame(detector: ObjectDetector, video: HTMLVideoElement, timestamp: number): Frame {
  const { videoWidth: w, videoHeight: h } = video;
  const frame: Frame = { seats: [], people: [] };
  if (!w || !h) return frame;
  for (const d of detector.detectForVideo(video, timestamp).detections) {
    const b = d.boundingBox;
    const label = d.categories[0]?.categoryName;
    if (!b || !label) continue;
    const box = { x: b.originX / w, y: b.originY / h, w: b.width / w, h: b.height / h };
    if (label === "person") frame.people.push(box);
    else if (SEAT_LABELS.has(label)) frame.seats.push(box);
  }
  return frame;
}
