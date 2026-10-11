/** Rear camera, small frames (fast on phones), playing inline and muted as Safari requires. */
export async function startRearCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  // React doesn't apply `muted` to server-rendered markup, so set it directly before playing.
  video.muted = true;
  video.setAttribute("playsinline", "");
  video.srcObject = stream;
  try {
    await video.play();
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("The camera started but the video couldn't play. Tap Start camera again.");
  }
  return stream;
}

/** A plain-language message for camera start-up failures. */
export function cameraErrorMessage(e: unknown): string {
  if (e instanceof DOMException && e.name === "NotAllowedError") {
    return "Camera access was blocked. On iPhone: tap aA in the address bar → Website Settings → Camera → Allow, then try again.";
  }
  if (e instanceof DOMException && e.name === "NotFoundError") return "No camera found on this device.";
  if (typeof window !== "undefined" && !window.isSecureContext) return "The camera only works on a secure (https) link.";
  return e instanceof Error ? e.message : "Couldn't start the camera.";
}
