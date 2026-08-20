/**
 * The same calendar the board is drawn from, published as JSON.
 *
 * The portfolio needs this data too, and GitHub's public HTML states a total
 * that disagrees with the contributions API by around twenty - so rather than
 * have the site scrape a second, subtly different number, it reads what this
 * run already fetched. One source, and the site and the profile always agree.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fetchCalendar, levelOf } from "./lib/calendar.mjs";

const USER = process.env.GH_USER || "shlok1806";
const OUT = process.env.OUT || "dist/contributions.json";

const cal = await fetchCalendar(USER);

const payload = {
  total: cal.totalContributions,
  generated: cal.weeks.at(-1)?.contributionDays.at(-1)?.date ?? null,
  weeks: cal.weeks.map((w) =>
    w.contributionDays.map((d) => ({
      date: d.date,
      count: d.contributionCount,
      level: levelOf(d),
      weekday: d.weekday,
    })),
  ),
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload));
console.log(`${OUT} - total ${payload.total}, ${payload.weeks.length} weeks`);
