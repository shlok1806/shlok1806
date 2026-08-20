/**
 * The contribution graph, played as a game of tetris on a handheld.
 *
 * The empty well is drawn once and stays put - only the days that actually have
 * contributions fall. Within a week, touching green cells travel together as one
 * piece and the lowest piece lands first, so a column stacks from the floor up,
 * and columns are staggered left to right so the board fills in one sweep.
 *
 * A piece enters above the well and descends one row at a time at a fixed rate,
 * the way a tetromino actually falls - a steps() drop, not a glide - then
 * flashes as it locks. Beside the well is the stat panel every handheld tetris
 * has: score, lines, level, and the next piece.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { T, MONO, esc, windowFrame } from "./lib/chrome.mjs";

const USER = process.env.GH_USER || "shlok1806";
const OUT = process.env.OUT || "dist/contrib-tetris.svg";

const CELL = 9;
const GAP = 2;
const PITCH = CELL + GAP;
const WIDTH = 840;
/** The content viewport windowFrame hands back, after its border and padding. */
const VIEW = WIDTH - 10 - 4;
const PAD = 12;
const LABEL_W = 24;
/** Well border plus the breathing room between it and the grid. */
const INSET = 8;
const PANEL_GAP = 16;
const BOX_GAP = 5;

/** Rows above the well a piece spawns at, so it enters from off the board. */
const LEAD = 2;
/** Seconds a piece takes to fall a single row. Constant, like real gravity. */
const STEP = 0.055;

/** NONE through FOURTH_QUARTILE, the Console preset's green ramp. */
const RAMP = ["#171c14", "#26400a", "#37650a", "#4e9a06", "#79d21a"];
const WELL_BG = "#0d100c";
const EDGE = "#37650a";
const EDGE_IN = "#26400a";

const LEVELS = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Deterministic, so a rerun with unchanged data produces an unchanged file. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function fetchCalendar() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required for the contributions GraphQL API");

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": `${USER}-profile-readme`,
    },
    body: JSON.stringify({
      query: `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{
        totalContributions weeks{contributionDays{date contributionCount contributionLevel weekday}}}}}}`,
      variables: { login: USER },
    }),
  });
  if (!res.ok) throw new Error(`graphql ${res.status} ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user.contributionsCollection.contributionCalendar;
}

/**
 * Cut one week's contribution days into bottom-up pieces of one to four cells.
 * A blank day is floor, not filler: it ends the piece above it.
 */
function piecesFor(days, rand) {
  const byDay = new Map(days.map((d) => [d.weekday, d]));
  const pieces = [];
  let run = [];
  let want = 1 + Math.floor(rand() * 4);

  const flush = () => {
    if (run.length) pieces.push(run);
    run = [];
    want = 1 + Math.floor(rand() * 4);
  };

  for (let wd = 6; wd >= 0; wd--) {
    const day = byDay.get(wd);
    if (!day || (LEVELS[day.contributionLevel] ?? 0) === 0) {
      flush();
      continue;
    }
    run.push(day);
    if (run.length === want) flush();
  }
  flush();
  return pieces;
}

function stats(cal) {
  const days = cal.weeks.flatMap((w) => w.contributionDays);
  const lines = days.filter((d) => d.contributionCount > 0).length;

  /* A quiet day that is still in progress should not end the streak. */
  let i = days.length - 1;
  if (days[i] && days[i].contributionCount === 0) i -= 1;
  let streak = 0;
  for (; i >= 0 && days[i].contributionCount > 0; i--) streak += 1;

  return { score: cal.totalContributions, lines, level: streak };
}

/** A bordered LCD plate, the way a handheld frames its well and its stats. */
function plate(x, y, w, h) {
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${WELL_BG}" stroke="${EDGE}" stroke-width="2"/>` +
    `<rect x="${x + 3.5}" y="${y + 3.5}" width="${w - 7}" height="${h - 7}" rx="1" fill="none" stroke="${EDGE_IN}" stroke-width="1"/>`
  );
}

function statBox(x, y, w, h, label, value) {
  return (
    plate(x, y, w, h) +
    `<text x="${x + w / 2}" y="${y + 16}" font-family="${MONO}" font-size="9" fill="${T.faint}" text-anchor="middle" letter-spacing="1">${esc(label)}</text>` +
    `<text x="${x + w / 2}" y="${y + h - 9}" font-family="${MONO}" font-size="14" font-weight="bold" fill="${T.accentInk}" text-anchor="middle">${esc(value)}</text>`
  );
}

/** The S-tetromino, sitting in the NEXT window. */
function nextBox(x, y, w, h) {
  const u = 7;
  const shape = [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ];
  const cx = x + w / 2 - (3 * u) / 2;
  const cy = y + h / 2 - u + 5;
  return (
    plate(x, y, w, h) +
    `<text x="${x + w / 2}" y="${y + 16}" font-family="${MONO}" font-size="9" fill="${T.faint}" text-anchor="middle" letter-spacing="1">NEXT</text>` +
    shape
      .map(
        ([sx, sy]) =>
          `<rect x="${cx + sx * u}" y="${cy + sy * u}" width="${u - 1}" height="${u - 1}" rx="1" fill="${RAMP[3]}"/>`,
      )
      .join("")
  );
}

function render(cal) {
  const weeks = cal.weeks;
  const gridW = weeks.length * PITCH - GAP;
  const gridH = 7 * PITCH - GAP;

  const wellX = PAD + LABEL_W;
  const wellY = PAD;
  const wellW = gridW + INSET * 2;
  const wellH = gridH + INSET * 2;

  const originX = wellX + INSET;
  const originY = wellY + INSET;

  const panelX = wellX + wellW + PANEL_GAP;
  const panelW = VIEW - PAD - panelX;
  const boxW = Math.floor((panelW - BOX_GAP) / 2);
  const boxH = Math.floor((wellH - BOX_GAP) / 2);

  const monthY = wellY + wellH + 14;
  const contentHeight = monthY + PAD;

  const rand = mulberry32(
    [...(weeks.at(-1)?.contributionDays.at(-1)?.date ?? "seed")].reduce((a, c) => a + c.charCodeAt(0), 0),
  );

  /* The empty well: every day of the year, drawn once and never moved. */
  const well = [];
  /* Only the days with contributions in them, which are what actually falls. */
  const pieces = [];
  let maxDelay = 0;

  weeks.forEach((week, w) => {
    const x = originX + w * PITCH;

    week.contributionDays.forEach((d) => {
      const y = originY + d.weekday * PITCH;
      well.push(
        `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="1.5" fill="${RAMP[0]}"><title>${esc(`${d.contributionCount} on ${d.date}`)}</title></rect>`,
      );
    });

    piecesFor(week.contributionDays, rand).forEach((piece, pi) => {
      const delay = w * 0.05 + pi * 0.09;
      /* Rows travelled: from LEAD above the well down to where it rests. */
      const rows = Math.min(...piece.map((d) => d.weekday)) + LEAD;
      const dur = rows * STEP;
      maxDelay = Math.max(maxDelay, delay + dur);

      const rects = piece
        .map((d) => {
          const y = originY + d.weekday * PITCH;
          const fill = RAMP[LEVELS[d.contributionLevel] ?? 0];
          return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="1.5" fill="${fill}"><title>${esc(`${d.contributionCount} on ${d.date}`)}</title></rect>`;
        })
        .join("");

      const anim =
        `fall ${dur.toFixed(3)}s steps(${rows}, end) ${delay.toFixed(2)}s both,` +
        `lock .22s ease-out ${(delay + dur).toFixed(2)}s both`;
      pieces.push(`<g style="--d:${rows * PITCH}px;animation:${anim}">${rects}</g>`);
    });
  });

  const monthLabels = [];
  let lastMonth = -1;
  weeks.forEach((week, w) => {
    const first = week.contributionDays[0];
    if (!first) return;
    const d = new Date(`${first.date}T00:00:00Z`);
    const m = d.getUTCMonth();
    if (m !== lastMonth && d.getUTCDate() <= 7 && w < weeks.length - 1) {
      lastMonth = m;
      monthLabels.push(
        `<text x="${originX + w * PITCH}" y="${monthY}" font-family="${MONO}" font-size="9" fill="${T.faint}">${MONTHS[m]}</text>`,
      );
    }
  });

  const dayLabels = [
    [1, "Mon"],
    [3, "Wed"],
    [5, "Fri"],
  ].map(
    ([wd, name]) =>
      `<text x="${wellX - 7}" y="${originY + wd * PITCH + CELL - 1}" font-family="${MONO}" font-size="9" fill="${T.faint}" text-anchor="end">${name}</text>`,
  );

  const s = stats(cal);
  const hud =
    statBox(panelX, wellY, boxW, boxH, "SCORE", String(s.score)) +
    statBox(panelX + boxW + BOX_GAP, wellY, boxW, boxH, "LINES", String(s.lines)) +
    statBox(panelX, wellY + boxH + BOX_GAP, boxW, boxH, "LEVEL", String(s.level)) +
    nextBox(panelX + boxW + BOX_GAP, wellY + boxH + BOX_GAP, boxW, boxH);

  const settle = (maxDelay + 0.25).toFixed(2);

  return windowFrame({
    width: WIDTH,
    contentHeight,
    title: `${USER}@github: ~/contributions.tetris`,
    body:
      `${plate(wellX, wellY, wellW, wellH)}\n` +
      `<g>${well.join("")}</g>\n${pieces.join("\n")}\n` +
      `<g class="chrome" style="animation-delay:${settle}s">${hud}${monthLabels.join("")}${dayLabels.join("")}</g>`,
    extraStyle: `
  @keyframes fall {
    from { transform: translateY(calc(-1 * var(--d))); }
    to   { transform: translateY(0); }
  }
  @keyframes lock {
    from { filter: brightness(2.6); }
    to   { filter: brightness(1); }
  }
  .chrome { opacity: 0; animation: appear .4s ease-out both; }
  @keyframes appear { to { opacity: 1; } }`,
  });
}

const cal = await fetchCalendar();
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, render(cal));
const s = stats(cal);
console.log(`${OUT} - score ${s.score}, lines ${s.lines}, level ${s.level}`);
