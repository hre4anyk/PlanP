// Copies the MediaPipe vision runtime into public/ and downloads the detector model once,
// so the camera demo never depends on a CDN (ARCHITECTURE §4). Runs before `dev` and `build`.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = join("public", "mediapipe");
const wasmOut = join(out, "wasm");
const wasmIn = join("node_modules", "@mediapipe", "tasks-vision", "wasm");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite";
const modelPath = join(out, "efficientdet_lite0.tflite");

mkdirSync(wasmOut, { recursive: true });
for (const file of [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
]) {
  copyFileSync(join(wasmIn, file), join(wasmOut, file));
}

if (!existsSync(modelPath)) {
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Model download failed: ${res.status}`);
  writeFileSync(modelPath, Buffer.from(await res.arrayBuffer()));
  console.log("mediapipe: downloaded detector model");
}
console.log("mediapipe: assets ready in public/mediapipe");
