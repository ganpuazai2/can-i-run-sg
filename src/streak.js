// Run log, streaks and badges. Logs are stored only on the device.
//
// Log shape: { "2026-10-15": "run" | "indoor" | "haze" }, one entry per day.
// "haze" is an indoor workout logged on a Nope day; it earns the Haze-Proof badge.

const DAY_MS = 864e5;
const SGT_OFFSET_MS = 8 * 3600e3;

/** Calendar date in Singapore time, as YYYY-MM-DD, whatever the device's time zone. */
export const dayKey = date => new Date(date.getTime() + SGT_OFFSET_MS).toISOString().slice(0, 10);

const isNextDay = (prev, day) => Date.parse(day) - Date.parse(prev) === DAY_MS;

function longestRun(days) {
  let best = 0, current = 0, prev = null;
  for (const day of days) {
    current = prev && isNextDay(prev, day) ? current + 1 : 1;
    best = Math.max(best, current);
    prev = day;
  }
  return best;
}

export function streakStats(log, now = new Date()) {
  const days = Object.keys(log).sort();
  // The streak is still alive if the last entry was yesterday.
  let cursor = log[dayKey(now)] ? now : new Date(now - DAY_MS);
  let streak = 0;
  while (log[dayKey(cursor)]) { streak++; cursor = new Date(cursor - DAY_MS); }
  const types = Object.values(log);
  return {
    streak,
    best: longestRun(days),
    total: days.length,
    outdoor: types.filter(v => v === "run").length,
    haze: types.filter(v => v === "haze").length,
  };
}

export function monthStats(log, month) {
  const days = Object.keys(log).filter(d => d.startsWith(month)).sort();
  return {
    active: days.length,
    runs: days.filter(d => log[d] === "run").length,
    indoor: days.filter(d => log[d] !== "run").length,
    haze: days.filter(d => log[d] === "haze").length,
    best: longestRun(days),
  };
}

/**
 * Logs or un-logs today's activity. Tapping the same button again undoes it.
 * @param {"run"|"indoor"} type
 * @param {boolean} nopeDay whether today's verdict is Nope (indoor sessions then count as "haze")
 */
export function toggleToday(log, day, type, nopeDay) {
  const next = { ...log };
  const current = next[day];
  const sameType = type === "run" ? current === "run" : current && current !== "run";
  if (sameType) delete next[day];
  else next[day] = type === "run" ? "run" : nopeDay ? "haze" : "indoor";
  return next;
}

// Names and descriptions live in strings.js under badge.<id> and badge.<id>.d.
export const BADGES = [
  { id: "first", icon: "👟", earned: s => s.total >= 1 },
  { id: "s3", icon: "🔥", earned: s => s.best >= 3 },
  { id: "s7", icon: "⚡", earned: s => s.best >= 7 },
  { id: "s30", icon: "👑", earned: s => s.best >= 30 },
  { id: "r10", icon: "🏃", earned: s => s.outdoor >= 10 },
  { id: "r50", icon: "🥇", earned: s => s.outdoor >= 50 },
  { id: "haze", icon: "🛡️", earned: s => s.haze >= 1 },
];

export function loadLog(storage = localStorage) {
  const log = JSON.parse(storage.getItem("runs") || "{}");
  // Early versions stored an array of dates.
  return Array.isArray(log) ? Object.fromEntries(log.map(d => [d, "run"])) : log;
}

export const saveLog = (log, storage = localStorage) => storage.setItem("runs", JSON.stringify(log));
