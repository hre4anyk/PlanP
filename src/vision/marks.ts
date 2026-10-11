import type { Box } from "@/logic/seats";

const MAX_SIDE = 768;

/**
 * Snapshot the video with numbered boxes drawn on it ("set of marks"), so Claude can answer
 * about each box by number. Returns base64 JPEG without the data: prefix.
 */
export function markedSnapshot(video: HTMLVideoElement, boxes: Box[], regions: { label: string; box: Box }[] = []): string {
  const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  g.drawImage(video, 0, 0, w, h);
  g.lineWidth = Math.max(2, w / 250);
  g.font = `bold ${Math.round(w / 28)}px sans-serif`;
  g.textBaseline = "top";
  boxes.forEach((b, i) => {
    const [x, y, bw, bh] = [b.x * w, b.y * h, b.w * w, b.h * h];
    g.strokeStyle = "#ffea00";
    g.strokeRect(x, y, bw, bh);
    const label = String(i + 1);
    const pad = 4;
    const tw = g.measureText(label).width + pad * 2;
    const th = Math.round(w / 28) + pad * 2;
    g.fillStyle = "#ffea00";
    g.fillRect(x, y, tw, th);
    g.fillStyle = "#000";
    g.fillText(label, x + pad, y + pad);
  });
  // Lettered regions (e.g. gaps between parked cars), in a second colour.
  regions.forEach(({ label, box: b }) => {
    const [x, y, bw, bh] = [b.x * w, b.y * h, b.w * w, b.h * h];
    g.strokeStyle = "#00e5ff";
    g.setLineDash([6, 4]);
    g.strokeRect(x, y, bw, bh);
    g.setLineDash([]);
    const pad = 4;
    const tw = g.measureText(label).width + pad * 2;
    const th = Math.round(w / 28) + pad * 2;
    g.fillStyle = "#00e5ff";
    g.fillRect(x + bw / 2 - tw / 2, y + bh / 2 - th / 2, tw, th);
    g.fillStyle = "#000";
    g.fillText(label, x + bw / 2 - tw / 2 + pad, y + bh / 2 - th / 2 + pad);
  });
  return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
}
