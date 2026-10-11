import { describe, expect, it } from "vitest";
import { arrival, meetingAt, spareText } from "./eta";

const now = new Date(2026, 9, 11, 14, 0);

describe("arrival", () => {
  it("adds the drive and the walk", () => {
    const a = arrival(now, 14, 5, meetingAt("15:00", now));
    expect(a.atDoor.getHours()).toBe(14);
    expect(a.atDoor.getMinutes()).toBe(19);
    expect(a.spareMin).toBe(41);
  });

  it("says how late you'll be", () => {
    expect(spareText(arrival(now, 50, 16, meetingAt("15:00", now)).spareMin!)).toBe("6 min late");
    expect(spareText(0)).toBe("right on time");
  });

  it("has no spare time without a meeting time", () => {
    expect(arrival(now, 10, 3, meetingAt("", now)).spareMin).toBeNull();
    expect(meetingAt("3pm", now)).toBeNull();
  });
});
