import { cameraDirection, type Orientation } from "@/logic/anchors";

type PermissionFn = () => Promise<"granted" | "denied">;

/**
 * Phone orientation for keeping chairs pinned. iPhone Safari only allows it after the user taps,
 * so call `requestOrientation()` inside a click handler. On laptops there's no sensor:
 * `available` stays false and the direction stays straight ahead.
 */
export class OrientationTracker {
  current: Orientation = { yaw: 0, pitch: 0 };
  available = false;
  private listener = (e: DeviceOrientationEvent) => {
    if (e.alpha === null || e.beta === null || e.gamma === null) return;
    this.available = true;
    this.current = cameraDirection(e.alpha, e.beta, e.gamma);
  };

  /** Ask for motion access (iPhone) and start listening. Never throws. */
  async start(): Promise<boolean> {
    const request = (DeviceOrientationEvent as unknown as { requestPermission?: PermissionFn }).requestPermission;
    if (request) {
      try {
        if ((await request()) !== "granted") return false;
      } catch {
        return false;
      }
    }
    window.addEventListener("deviceorientation", this.listener);
    return true;
  }

  stop() {
    window.removeEventListener("deviceorientation", this.listener);
  }
}
