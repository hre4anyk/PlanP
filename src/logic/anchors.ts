import type { Box } from "./seats";

// Keeping chairs "pinned" while the phone moves, without AR (iPhone Safari has no WebXR):
// at scan time each chair is stored as a direction in the room (yaw/pitch, degrees), from the
// phone's orientation sensors + where the chair sits in the picture. Afterwards we project those
// directions back onto the screen as the phone turns, and snap to the live detector when it sees
// the chair, which also corrects drift as you walk (ARCHITECTURE §6.1).

export type Orientation = { yaw: number; pitch: number };
export type Fov = { h: number; v: number };
export type Anchor = { yaw: number; pitch: number; w: number; h: number };

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Wrap an angle to (-180, 180]. */
export function wrap(angle: number): number {
  let a = angle % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
}

/** Field of view of a camera frame with the given aspect (w/h), from its diagonal field of view. */
export function fovFor(aspect: number, diagonalDeg = 75): Fov {
  const halfDiag = Math.tan(rad(diagonalDeg / 2));
  const diag = Math.hypot(aspect, 1);
  return { h: 2 * deg(Math.atan((halfDiag * aspect) / diag)), v: 2 * deg(Math.atan(halfDiag / diag)) };
}

/** Where the rear camera points, from DeviceOrientation alpha/beta/gamma (W3C Z-X'-Y'' angles). */
export function cameraDirection(alpha: number, beta: number, gamma: number): Orientation {
  const [a, b, g] = [rad(alpha), rad(beta), rad(gamma)];
  // Third column of R = Rz(a)·Rx(b)·Ry(g); the rear camera looks along the device's -Z.
  const x = -(Math.cos(a) * Math.sin(g) + Math.sin(a) * Math.sin(b) * Math.cos(g));
  const y = -(Math.sin(a) * Math.sin(g) - Math.cos(a) * Math.sin(b) * Math.cos(g));
  const z = -(Math.cos(b) * Math.cos(g));
  return { yaw: wrap(deg(Math.atan2(x, y))), pitch: deg(Math.asin(Math.max(-1, Math.min(1, z)))) };
}

/** Pin a box seen in the picture to a direction in the room. */
export function anchorFromBox(box: Box, camera: Orientation, fov: Fov): Anchor {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const yaw = camera.yaw + deg(Math.atan((cx - 0.5) * 2 * Math.tan(rad(fov.h / 2))));
  const pitch = camera.pitch - deg(Math.atan((cy - 0.5) * 2 * Math.tan(rad(fov.v / 2))));
  return { yaw: wrap(yaw), pitch, w: box.w, h: box.h };
}

/**
 * Where an anchored chair appears on screen now. `inView` is false when it's behind or beside
 * the phone; `bearing` is how far to turn (negative = left) and drives the edge arrow.
 */
export function project(anchor: Anchor, camera: Orientation, fov: Fov) {
  const dYaw = wrap(anchor.yaw - camera.yaw);
  const dPitch = anchor.pitch - camera.pitch;
  const front = Math.abs(dYaw) < 89;
  const cx = 0.5 + Math.tan(rad(dYaw)) / (2 * Math.tan(rad(fov.h / 2)));
  const cy = 0.5 - Math.tan(rad(dPitch)) / (2 * Math.tan(rad(fov.v / 2)));
  const box: Box = { x: cx - anchor.w / 2, y: cy - anchor.h / 2, w: anchor.w, h: anchor.h };
  const inView = front && cx > 0 && cx < 1 && cy > 0 && cy < 1;
  return { box, inView, bearing: dYaw };
}

/**
 * Re-centre an anchor on the live detection nearest to where we expect it (within `radius`,
 * in screen units), blending to stay stable. Returns the anchor unchanged if nothing is close.
 */
export function snapAnchor(
  anchor: Anchor,
  detections: Box[],
  camera: Orientation,
  fov: Fov,
  radius = 0.15,
  blend = 0.35,
): { anchor: Anchor; matched: Box | null } {
  const expected = project(anchor, camera, fov);
  if (!expected.inView) return { anchor, matched: null };
  const ex = expected.box.x + expected.box.w / 2;
  const ey = expected.box.y + expected.box.h / 2;
  let best: Box | null = null;
  let bestDist = radius;
  for (const d of detections) {
    const dist = Math.hypot(d.x + d.w / 2 - ex, d.y + d.h / 2 - ey);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  if (!best) return { anchor, matched: null };
  const seen = anchorFromBox(best, camera, fov);
  return {
    matched: best,
    anchor: {
      yaw: wrap(anchor.yaw + wrap(seen.yaw - anchor.yaw) * blend),
      pitch: anchor.pitch + (seen.pitch - anchor.pitch) * blend,
      w: anchor.w + (seen.w - anchor.w) * blend,
      h: anchor.h + (seen.h - anchor.h) * blend,
    },
  };
}

/** "Turn left", "straight ahead"… for the guidance card and the voice. */
export function turnHint(bearing: number): string {
  const a = Math.abs(bearing);
  if (a < 15) return "straight ahead";
  const side = bearing < 0 ? "left" : "right";
  if (a < 60) return `slightly ${side}`;
  if (a < 120) return `turn ${side}`;
  return "behind you";
}
