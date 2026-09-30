/** Minimal timezone helpers (no dependency): periods are computed in the business's timezone. */
function offsetMs(timeZone: string, at: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** UTC instant of local midnight on the given local calendar day. */
export function zonedMidnight(timeZone: string, year: number, monthIndex: number, day: number) {
  const guess = new Date(Date.UTC(year, monthIndex, day));
  return new Date(guess.getTime() - offsetMs(timeZone, guess));
}

export function localParts(timeZone: string, at = new Date()) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone }).format(at).split("-").map(Number);
  return { year: y!, monthIndex: m! - 1, day: d! };
}

export function monthRange(timeZone: string, at = new Date(), monthsBack = 0) {
  const { year, monthIndex } = localParts(timeZone, at);
  return {
    from: zonedMidnight(timeZone, year, monthIndex - monthsBack, 1),
    to: zonedMidnight(timeZone, year, monthIndex - monthsBack + 1, 1),
  };
}

export function daysAgo(timeZone: string, days: number, at = new Date()) {
  const { year, monthIndex, day } = localParts(timeZone, at);
  return zonedMidnight(timeZone, year, monthIndex, day - days);
}
