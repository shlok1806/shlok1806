/**
 * A year of contributions, played as one arcade cabinet: tetris, then snake.
 *
 * Act one - the well is empty and every day with contributions in it drops from
 * above. Touching days in a week fall together as one piece, the lowest lands
 * first, and a piece descends one row per tick rather than gliding, which is
 * what makes it read as a tetromino. Columns are staggered left to right so the
 * year assembles in one sweep.
 *
 * Act two - a snake comes in off the left edge and eats the board it just built,
 * sweeping row by row. Every square it swallows goes dark and fills in the meter
 * underneath, and then it leaves and the cabinet starts over.
 *
 * The board is drawn to match Platane/snk, which is where the snake idea comes
 * from: its 12px cells on a 16px pitch, its GitHub palette, and its four
 * tapering segments. The snake is one path and four followers - segment i is
 * where the head was i ticks ago, so they all ride the same keyframes offset by
 * their own animation-delay.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { T, MONO, esc, windowFrame } from "./lib/chrome.mjs";
import { levelOf, fetchCalendar, monthMarks } from "./lib/calendar.mjs";

const USER = process.env.GH_USER || "shlok1806";
const OUT = process.env.OUT || "dist/contributions.svg";

/* snk's geometry, so the board reads as the one everybody knows. */
const CELL = 12;
const PITCH = 16;
const RX = 2;

/* snk's github-dark palette. */
const RAMP = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];
/** What a square becomes once it has been eaten. */
const EATEN = "#161b22";
/** The hairline snk draws around every square. */
const CELL_EDGE = "#1b1f230a";
const SNAKE = "purple";

/* GitHub's own dark chrome, to go with its palette. */
const WELL_BG = "#0d1117";
const EDGE = "#30363d";
const EDGE_IN = "#21262d";
const HUD_INK = "#39d353";

/** snk publishes at 880; matching it means GitHub renders this unscaled. */
const WIDTH = 880;
/** The content viewport windowFrame hands back, after its border and padding. */
const VIEW = WIDTH - 10 - 4;
const PAD = 8;
/** Well border plus the breathing room between it and the grid. */
const INSET = 6;
const BAR_H = 10;
const HUD_H = 34;
const HUD_GAP = 4;

/* Act one. */
const LEAD = 2;
const DROP_STEP = 0.055;
const DROP_STAGGER = 0.05;
const DROP_PIECE_GAP = 0.09;
/** Beat between the board finishing and the snake showing up. */
const INTERMISSION = 0.9;

/* Act two. */
const TICK = 0.04;
/** snk's snake is four segments and does not grow. */
const SEGMENTS = [
  { off: 0.8, size: 14.4, rx: 4.5 },
  { off: 1.8, size: 12.3, rx: 4.1 },
  { off: 2.6, size: 10.8, rx: 3.6 },
  { off: 3.0, size: 9.9, rx: 3.3 },
];
/** Cells of runway either side, so it enters and leaves already moving. */
const RUNWAY = 6;
/** Beat after it leaves, before the cabinet resets. */
const OUTRO = 1.1;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
    if (!day || levelOf(day) === 0) {
      flush();
      continue;
    }
    run.push(day);
    if (run.length === want) flush();
  }
  flush();
  return pieces;
}

/**
 * Boustrophedon: right along one weekday, down, left along the next. It covers
 * every square exactly once, which is what lets the snake eat the whole year.
 */
function buildPath(weekCount) {
  const cells = [];
  for (let row = 0; row < 7; row++) {
    for (let i = 0; i < weekCount; i++) {
      cells.push({ col: row % 2 === 0 ? i : weekCount - 1 - i, row });
    }
  }
  const lead = [];
  for (let i = RUNWAY; i > 0; i--) lead.push({ col: -i, row: 0 });
  const last = cells[cells.length - 1];
  const tail = [];
  for (let i = 1; i <= RUNWAY + SEGMENTS.length; i++) tail.push({ col: last.col + i, row: last.row });
  return { path: [...lead, ...cells, ...tail], offset: lead.length };
}

function stats(cal) {
  const days = cal.weeks.flatMap((w) => w.contributionDays);
  const lines = days.filter((d) => d.contributionCount > 0).length;
  let i = days.length - 1;
  /* A quiet day that is still in progress should not end the streak. */
  if (days[i] && days[i].contributionCount === 0) i -= 1;
  let level = 0;
  for (; i >= 0 && days[i].contributionCount > 0; i--) level += 1;
  return { score: cal.totalContributions, lines, level };
}

function plate(x, y, w, h) {
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${WELL_BG}" stroke="${EDGE}" stroke-width="2"/>` +
    `<rect x="${x + 3.5}" y="${y + 3.5}" width="${w - 7}" height="${h - 7}" rx="1" fill="none" stroke="${EDGE_IN}" stroke-width="1"/>`
  );
}

function statBox(x, y, w, h, label, value) {
  return (
    plate(x, y, w, h) +
    `<text x="${x + w / 2}" y="${y + 14}" font-family="${MONO}" font-size="9" fill="${T.faint}" text-anchor="middle" letter-spacing="1">${esc(label)}</text>` +
    `<text x="${x + w / 2}" y="${y + h - 8}" font-family="${MONO}" font-size="14" font-weight="bold" fill="${HUD_INK}" text-anchor="middle">${esc(value)}</text>`
  );
}

function nextBox(x, y, w, h) {
  const u = 6;
  const shape = [[1, 0], [2, 0], [0, 1], [1, 1]];
  const cx = x + w / 2 - (3 * u) / 2;
  const cy = y + h - 8 - u * 2 + 2;
  return (
    plate(x, y, w, h) +
    `<text x="${x + w / 2}" y="${y + 14}" font-family="${MONO}" font-size="9" fill="${T.faint}" text-anchor="middle" letter-spacing="1">NEXT</text>` +
    shape
      .map(([sx, sy]) => `<rect x="${cx + sx * u}" y="${cy + sy * u}" width="${u - 1}" height="${u - 1}" rx="1" fill="${RAMP[3]}"/>`)
      .join("")
  );
}

function render(cal) {
  const weeks = cal.weeks;
  const gridW = weeks.length * PITCH - (PITCH - CELL);
  const gridH = 7 * PITCH - (PITCH - CELL);

  const wellW = gridW + INSET * 2;
  const wellH = gridH + INSET * 2;
  const wellX = Math.round((VIEW - wellW) / 2);
  const wellY = PAD;
  const originX = wellX + INSET;
  const originY = wellY + INSET;

  const monthY = wellY + wellH + 13;
  const barY = monthY + 6;
  const hudY = barY + BAR_H + 8;
  const contentHeight = hudY + HUD_H + PAD;

  const rand = mulberry32(
    (weeks.at(-1)?.contributionDays.at(-1)?.date ?? "seed")
      .split("")
      .reduce((a, c) => a + c.charCodeAt(0), 0),
  );

  /* Act one, laid out first because act two starts when it finishes. */
  const drops = [];
  let dropEnd = 0;
  weeks.forEach((week, w) => {
    piecesFor(week.contributionDays, rand).forEach((piece, pi) => {
      const delay = w * DROP_STAGGER + pi * DROP_PIECE_GAP;
      /*
       * Measured from the piece's *lowest* cell, not its highest. Offsetting by
       * the top cell only lifts a tall piece partway out of the well, leaving
       * its bottom cells hanging in the top rows until its turn comes.
       */
      const rows = Math.max(...piece.map((d) => d.weekday)) + LEAD;
      dropEnd = Math.max(dropEnd, delay + rows * DROP_STEP);
      drops.push({ week: w, piece, delay, rows });
    });
  });

  const { path, offset } = buildPath(weeks.length);
  const snakeStart = dropEnd + INTERMISSION;
  const D = snakeStart + path.length * TICK + OUTRO;
  const at = (t) => ((t / D) * 100).toFixed(4);

  /* Which step of the sweep swallows each square. */
  const eatStep = new Map();
  path.forEach((p, i) => {
    if (i >= offset) eatStep.set(`${p.col}:${p.row}`, i);
  });

  const keyframes = [];
  const cells = [];
  const dropped = [];
  /** Eat times per level, which is what fills the meter underneath. */
  const byLevel = [[], [], [], [], []];

  weeks.forEach((week, w) => {
    week.contributionDays.forEach((d) => {
      if (levelOf(d) !== 0) return;
      cells.push(
        `<rect x="${originX + w * PITCH}" y="${originY + d.weekday * PITCH}" width="${CELL}" height="${CELL}" rx="${RX}" fill="${RAMP[0]}" stroke="${CELL_EDGE}"><title>${esc(`${d.contributionCount} on ${d.date}`)}</title></rect>`,
      );
    });
  });

  drops.forEach(({ week: w, piece, delay, rows }, n) => {
    const x = originX + w * PITCH;

    /* Held above the well, then one row per tick, then a flash as it locks. */
    const stops = [`0%,${at(delay)}%{transform:translateY(-${rows * PITCH}px)}`];
    for (let k = 1; k < rows; k++) {
      stops.push(`${at(delay + k * DROP_STEP)}%{transform:translateY(-${(rows - k) * PITCH}px)}`);
    }
    const landed = delay + rows * DROP_STEP;
    stops.push(`${at(landed)}%{transform:translateY(0);filter:brightness(2)}`);
    stops.push(`${at(landed + 0.12)}%,100%{transform:translateY(0);filter:brightness(1)}`);
    keyframes.push(`@keyframes d${n}{${stops.join("")}}`);

    const rects = piece.map((d) => {
      const level = levelOf(d);
      const step = eatStep.get(`${w}:${d.weekday}`);
      byLevel[level].push(snakeStart + step * TICK);
      keyframes.push(
        `@keyframes e${w}_${d.weekday}{0%{fill:${RAMP[level]}}${at(snakeStart + step * TICK)}%{fill:${EATEN}}}`,
      );
      return (
        `<rect x="${x}" y="${originY + d.weekday * PITCH}" width="${CELL}" height="${CELL}" rx="${RX}"` +
        ` fill="${RAMP[level]}" stroke="${CELL_EDGE}" style="animation:e${w}_${d.weekday} ${D.toFixed(2)}s step-end infinite">` +
        `<title>${esc(`${d.contributionCount} on ${d.date}`)}</title></rect>`
      );
    });

    dropped.push(`<g style="animation:d${n} ${D.toFixed(2)}s step-end infinite">${rects.join("")}</g>`);
  });

  /* Act two: one route, ridden by every segment at its own offset. */
  const pos = (p) => `translate(${originX + p.col * PITCH}px,${originY + p.row * PITCH}px)`;
  const route = [`0%,${at(snakeStart)}%{transform:${pos(path[0])}}`];
  path.forEach((p, i) => {
    if (i > 0) route.push(`${at(snakeStart + i * TICK)}%{transform:${pos(p)}}`);
  });
  route.push(`100%{transform:${pos(path[path.length - 1])}}`);
  keyframes.push(`@keyframes route{${route.join("")}}`);

  const snake = SEGMENTS.map(
    (s, i) =>
      `<rect x="${s.off}" y="${s.off}" width="${s.size}" height="${s.size}" rx="${s.rx}" ry="${s.rx}" fill="${SNAKE}"` +
      ` style="animation:route ${D.toFixed(2)}s step-end ${(i * TICK).toFixed(3)}s infinite both"/>`,
  ).join("");

  /*
   * The meter snk draws under the board: one bar per contribution level, each
   * filling in step as the snake works through that level's squares.
   */
  const totalEaten = byLevel.reduce((n, t) => n + t.length, 0) || 1;
  let barX = originX;
  const bars = byLevel
    .map((times, level) => {
      if (level === 0 || !times.length) return "";
      const w = (times.length / totalEaten) * gridW;
      const sorted = [...times].sort((a, b) => a - b);
      const stops = [`0%,${at(sorted[0])}%{transform:scaleX(0)}`];
      sorted.forEach((t, k) => stops.push(`${at(t)}%{transform:scaleX(${((k + 1) / sorted.length).toFixed(4)})}`));
      stops.push(`100%{transform:scaleX(1)}`);
      keyframes.push(`@keyframes u${level}{${stops.join("")}}`);

      const rect =
        `<rect x="${barX.toFixed(1)}" y="${barY}" width="${w.toFixed(1)}" height="${BAR_H}" rx="2" fill="${RAMP[level]}"` +
        ` style="transform-box:fill-box;transform-origin:left center;animation:u${level} ${D.toFixed(2)}s step-end infinite"/>`;
      barX += w;
      return rect;
    })
    .join("");

  const months = monthMarks(weeks)
    .map((m) => `<text x="${originX + m.week * PITCH}" y="${monthY}" font-family="${MONO}" font-size="9" fill="${T.faint}">${m.label}</text>`)
    .join("");

  const s = stats(cal);
  const boxW = Math.floor((wellW - HUD_GAP * 3) / 4);
  const hud =
    statBox(wellX, hudY, boxW, HUD_H, "SCORE", String(s.score)) +
    statBox(wellX + (boxW + HUD_GAP), hudY, boxW, HUD_H, "LINES", String(s.lines)) +
    statBox(wellX + (boxW + HUD_GAP) * 2, hudY, boxW, HUD_H, "LEVEL", String(s.level)) +
    nextBox(wellX + (boxW + HUD_GAP) * 3, hudY, boxW, HUD_H);

  /*
   * The playfield. This has to be declared inside the body rather than handed to
   * windowFrame as a def: the body is drawn in a nested <svg>, which starts its
   * own user space, and a userSpaceOnUse clip written in the outer one lands
   * offset by the whole window frame - close enough to look simply ignored.
   */
  const clip = `<clipPath id="pit"><rect x="${wellX + 4}" y="${wellY + 4}" width="${wellW - 8}" height="${wellH - 8}"/></clipPath>`;

  return windowFrame({
    width: WIDTH,
    contentHeight,
    title: `${USER}@github: ~/contributions`,
    body:
      `${clip}\n${plate(wellX, wellY, wellW, wellH)}\n` +
      `<g>${cells.join("")}</g>\n` +
      `<g clip-path="url(#pit)">${dropped.join("")}\n${snake}</g>\n` +
      `${months}${bars}${hud}`,
    extraStyle: `\n  ${keyframes.join("\n  ")}`,
  });
}

const cal = await fetchCalendar(USER);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, render(cal));
const s = stats(cal);
console.log(`${OUT} - score ${s.score}, lines ${s.lines}, level ${s.level}`);
