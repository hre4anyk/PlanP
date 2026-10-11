import { describe, expect, it } from "vitest";
import { anchorFromBox, cameraDirection, fovFor, project, snapAnchor, turnHint, wrap } from "./anchors";

const fov = fovFor(3 / 4); // portrait 480×640 frame
const ahead = { yaw: 0, pitch: 0 };
const centred = { x: 0.45, y: 0.45, w: 0.1, h: 0.1 };

describe("cameraDirection", () => {
  it("points north and level when the phone is upright facing north", () => {
    const d = cameraDirection(0, 90, 0);
    expect(d.yaw).toBeCloseTo(0);
    expect(d.pitch).toBeCloseTo(0);
  });

  it("looks down when the top of the phone tips away", () => {
    expect(cameraDirection(0, 60, 0).pitch).toBeCloseTo(-30);
  });

  it("turns with the compass angle", () => {
    // alpha grows counter-clockwise, so turning the phone left increases alpha and lowers yaw
    expect(cameraDirection(30, 90, 0).yaw).toBeCloseTo(-30);
  });
});

describe("fovFor", () => {
  it("is narrower across than up and down for a portrait frame", () => {
    expect(fov.h).toBeLessThan(fov.v);
    expect(fov.h).toBeGreaterThan(30);
  });
});

describe("anchor + project", () => {
  it("puts a chair back where it was when the phone hasn't moved", () => {
    const box = { x: 0.6, y: 0.3, w: 0.1, h: 0.2 };
    const p = project(anchorFromBox(box, ahead, fov), ahead, fov);
    expect(p.inView).toBe(true);
    expect(p.box.x).toBeCloseTo(box.x);
    expect(p.box.y).toBeCloseTo(box.y);
  });

  it("slides the chair left on screen when the phone turns right", () => {
    const anchor = anchorFromBox(centred, ahead, fov);
    const p = project(anchor, { yaw: 10, pitch: 0 }, fov);
    expect(p.box.x + p.box.w / 2).toBeLessThan(0.5);
    expect(p.bearing).toBeCloseTo(-10);
  });

  it("reports a chair behind you as out of view", () => {
    const p = project(anchorFromBox(centred, ahead, fov), { yaw: 170, pitch: 0 }, fov);
    expect(p.inView).toBe(false);
    expect(turnHint(p.bearing)).toBe("behind you");
  });

  it("handles the ±180° seam", () => {
    const anchor = anchorFromBox(centred, { yaw: 179, pitch: 0 }, fov);
    expect(project(anchor, { yaw: -179, pitch: 0 }, fov).inView).toBe(true);
    expect(wrap(190)).toBe(-170);
  });
});

describe("snapAnchor", () => {
  it("moves the anchor toward a nearby live detection", () => {
    const anchor = anchorFromBox(centred, ahead, fov);
    const seen = { x: 0.5, y: 0.45, w: 0.1, h: 0.1 };
    const { anchor: snapped, matched } = snapAnchor(anchor, [seen], ahead, fov);
    expect(matched).toBe(seen);
    expect(snapped.yaw).toBeGreaterThan(anchor.yaw);
  });

  it("ignores detections far from where the chair should be", () => {
    const anchor = anchorFromBox(centred, ahead, fov);
    const { anchor: same, matched } = snapAnchor(anchor, [{ x: 0.05, y: 0.8, w: 0.1, h: 0.1 }], ahead, fov);
    expect(matched).toBeNull();
    expect(same).toBe(anchor);
  });
});

describe("turnHint", () => {
  it("speaks in plain directions", () => {
    expect([0, -30, 40, -90, 150].map(turnHint)).toEqual([
      "straight ahead",
      "slightly left",
      "slightly right",
      "turn left",
      "behind you",
    ]);
  });
});
