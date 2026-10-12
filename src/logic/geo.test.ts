import { describe, expect, it } from "vitest";
import { distanceMetres, walkDistanceText, walkMinutes } from "./geo";

const meeting = { lat: 37.7824242, lng: -122.3932435 };
const spot = { lat: 37.78081044930759, lng: -122.3934291323988 };

describe("walkDistanceText", () => {
  it("shows minutes and miles from a parking spot to the meeting", () => {
    expect(walkDistanceText(spot, meeting)).toBe("2 min walk · 0.11 mi to destination");
    expect(walkMinutes(spot, meeting)).toBe(Math.max(1, Math.round(distanceMetres(spot, meeting) / 80)));
  });

  it("measures against the original meeting rather than a backup parking target", () => {
    const backup = { lat: 37.784, lng: -122.4005 };
    expect(walkDistanceText(spot, meeting)).not.toBe(walkDistanceText(spot, backup));
  });

  it("keeps a minimum one-minute walk at the destination", () => {
    expect(walkDistanceText(meeting, meeting)).toBe("1 min walk · 0.00 mi to destination");
  });
});
