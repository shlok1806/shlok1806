/** The GitHub contribution year, shared by everything that draws it. */

/** NONE through FOURTH_QUARTILE, the Console preset's green ramp. */
export const RAMP = ["#171c14", "#26400a", "#37650a", "#4e9a06", "#79d21a"];

export const LEVELS = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const levelOf = (day) => LEVELS[day.contributionLevel] ?? 0;

export async function fetchCalendar(user) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required for the contributions GraphQL API");

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": `${user}-profile-readme`,
    },
    body: JSON.stringify({
      query: `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{
        totalContributions weeks{contributionDays{date contributionCount contributionLevel weekday}}}}}}`,
      variables: { login: user },
    }),
  });
  if (!res.ok) throw new Error(`graphql ${res.status} ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user.contributionsCollection.contributionCalendar;
}

/** Month labels, at the week each new month opens in. */
export function monthMarks(weeks) {
  const marks = [];
  let last = -1;
  weeks.forEach((week, w) => {
    const first = week.contributionDays[0];
    if (!first) return;
    const d = new Date(`${first.date}T00:00:00Z`);
    const m = d.getUTCMonth();
    if (m !== last && d.getUTCDate() <= 7 && w < weeks.length - 1) {
      last = m;
      marks.push({ week: w, label: MONTHS[m] });
    }
  });
  return marks;
}
