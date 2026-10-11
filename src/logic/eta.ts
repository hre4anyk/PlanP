/** "14:37" in the phone's local time. */
export function clock(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Today's date at "HH:MM" (from an <input type="time">), or null if empty/invalid. */
export function meetingAt(hhmm: string, now: Date): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const at = new Date(now);
  at.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return at;
}

export type Arrival = { atDoor: Date; spareMin: number | null };

/** When you'll be at the meeting door: drive, then walk from where you park. */
export function arrival(now: Date, driveMin: number, walkMin: number, meeting: Date | null): Arrival {
  const atDoor = new Date(now.getTime() + (driveMin + walkMin) * 60_000);
  const spareMin = meeting ? Math.round((meeting.getTime() - atDoor.getTime()) / 60_000) : null;
  return { atDoor, spareMin };
}

/** "23 min spare" / "on the dot" / "6 min late". */
export function spareText(spareMin: number): string {
  if (spareMin > 0) return `${spareMin} min spare`;
  if (spareMin === 0) return "right on time";
  return `${-spareMin} min late`;
}
