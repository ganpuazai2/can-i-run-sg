// Picks the best upcoming window from NEA's 24-hour forecast.
// NEA splits the day into periods starting at 06:00, 12:00 and 18:00 Singapore time.

export const weatherSeverity = text => (/thunder/i.test(text) ? 2 : /rain|shower/i.test(text) ? 1 : 0);

// When the weather ties, prefer cool mornings, then evenings, and avoid midday heat.
const TIME_PENALTY = { "06": 0, "18": 0.2, "12": 0.5 };

const startHour = period => period.timePeriod.start.slice(11, 13);

/** Translation key describing when a period starts, relative to `today` (YYYY-MM-DD, SGT). */
export function periodKey(period, today) {
  const isToday = period.timePeriod.start.slice(0, 10) === today;
  switch (startHour(period)) {
    case "06": return isToday ? "when.todayMorning" : "when.tomorrowMorning";
    case "12": return isToday ? "when.todayAfternoon" : "when.tomorrowAfternoon";
    case "18": return isToday ? "when.tonight" : "when.tomorrowNight";
    default: return isToday ? "when.today" : "when.tomorrow";
  }
}

export function bestPeriod(periods, region) {
  const rank = p => weatherSeverity(p.regions?.[region]?.text ?? "") + (TIME_PENALTY[startHour(p)] ?? 0.3);
  return periods.reduce((best, p) => (rank(p) < rank(best) ? p : best));
}
