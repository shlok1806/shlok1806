/**
 * Platane/snk's snake, with our tetris opening spliced into its loop.
 *
 * The board, the snake, its pathfinding, its palette and its eating times are
 * all snk's own SVG, untouched - this script only re-times it. snk's cycle is
 * stretched by an intro window, and every percentage in its keyframes is
 * shifted so the whole game starts after the intro. During that window each
 * colored cell is held above the board by a wrapper group and dropped in as a
 * tetromino: touching days in a week fall together, the lowest piece lands
 * first, one row per tick. Both halves share one period, so the loop is
 * drop -> eat -> drop, forever.
 *
 * The shift is safe because of how snk writes its CSS: every animated element
 * carries its 0% state as its base style, so the region between 0% and the
 * first shifted keyframe interpolates between two equal values - a hold. The
 * wrappers animate transform on a parent group while snk animates fill on the
 * rect itself, so the two never touch the same property.
 *
 * Everything outside the well - the window chrome, the labels, the handheld
 * panel - is ours, in the Console palette the portfolio uses.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { T, MONO, esc, windowFrame } from "./lib/chrome.mjs";
import { fetchCalendar, monthMarks } from "./lib/calendar.mjs";

const USER = process.env.GH_USER || "shlok1806";
const SNK_IN = process.env.SNK_IN || "raw/snake.svg";
const OUT = process.env.OUT || "dist/contributions.svg";

/* The tetris opening. */
/** Rows above the top of snk's canvas a piece is held, so it starts unseen. */
const LEAD = 4;
/** Seconds a piece takes to fall a single row. Constant, like real gravity. */
const STEP = 0.055;
const STAGGER = 0.05;
const PIECE_GAP = 0.09;
/** Beat between the last piece locking and snk's game beginning. */
const SETTLE = 0.6;

/* Ours, outside the well: the Console palette the rest of the profile wears. */
const EDGE = "#37650a";
const EDGE_IN = "#26400a";
/** The interior stays snk's own canvas color; its palette was tuned on it. */
const WELL_BG = "#0d1117";

const PAD = 8;
const LABEL_W = 26;
const INSET = 6;
const HUD_H = 34;
const HUD_GAP = 5;

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
    `<text x="${x + w / 2}" y="${y + h - 8}" font-family="${MONO}" font-size="14" font-weight="bold" fill="${T.accentInk}" text-anchor="middle">${esc(value)}</text>`
  );
}

/** The S-tetromino, sitting in the NEXT window. */
function nextBox(x, y, w, h) {
  const u = 6;
  const shape = [[1, 0], [2, 0], [0, 1], [1, 1]];
  const cx = x + w / 2 - (3 * u) / 2;
  const cy = y + h - 8 - u * 2 + 2;
  return (
    plate(x, y, w, h) +
    `<text x="${x + w / 2}" y="${y + 14}" font-family="${MONO}" font-size="9" fill="${T.faint}" text-anchor="middle" letter-spacing="1">NEXT</text>` +
    shape
      .map(([sx, sy]) => `<rect x="${cx + sx * u}" y="${cy + sy * u}" width="${u - 1}" height="${u - 1}" rx="1" fill="${T.accent}"/>`)
      .join("")
  );
}

/* ------------------------------------------------------------------ snk in */

const raw = readFileSync(SNK_IN, "utf8");
const vb = raw.match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/);
if (!vb) throw new Error("no viewBox in snk svg");
const [vx, vy, vw, vh] = vb.slice(1).map(Number);

const styleMatch = raw.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) throw new Error("no style block in snk svg");
let style = styleMatch[1];
let body = raw.slice(raw.indexOf("</style>") + 8, raw.lastIndexOf("</svg>"));

/** snk's own cycle, read off its shorthand rather than assumed. */
const cycle = Number((style.match(/animation:none (\d+)ms/) ?? style.match(/(\d+)ms/))[1]);

/* Every cell, to find the grid; the animated ones, which are what falls. */
const attr = (tag, name) => tag.match(new RegExp(`${name}="(-?[\\d.]+)"`))?.[1];
const allCells = [...body.matchAll(/<rect class="c[^"]*"[^/]*\/>/g)].map((m) => m[0]);
const xs = allCells.map((t) => Number(attr(t, "x")));
const ys = allCells.map((t) => Number(attr(t, "y")));
const minX = Math.min(...xs);
const minY = Math.min(...ys);
const pitch = Math.min(...[...new Set(xs)].sort((a, b) => a - b).slice(1).map((x, i, arr) => x - ([minX, ...arr][i]))) || 16;

const animated = [...body.matchAll(/<rect class="c c[0-9a-z]+"[^/]*\/>/g)].map((m) => ({
  tag: m[0],
  col: Math.round((Number(attr(m[0], "x")) - minX) / pitch),
  row: Math.round((Number(attr(m[0], "y")) - minY) / pitch),
}));
if (!animated.length) throw new Error("no animated cells found in snk svg");

/* -------------------------------------------------- the tetris opening */

const rand = mulberry32(animated.length * 2654435761);

/* Per column, bottom-up: contiguous runs, cut into pieces of one to four. */
const byCol = new Map();
animated.forEach((c) => {
  if (!byCol.has(c.col)) byCol.set(c.col, []);
  byCol.get(c.col).push(c);
});

const pieces = [];
[...byCol.keys()].sort((a, b) => a - b).forEach((col) => {
  const cells = byCol.get(col).sort((a, b) => b.row - a.row);
  let run = [];
  let want = 1 + Math.floor(rand() * 4);
  let pi = 0;
  const flush = () => {
    if (run.length) pieces.push({ col, index: pi++, cells: run });
    run = [];
    want = 1 + Math.floor(rand() * 4);
  };
  cells.forEach((c, i) => {
    /* A gap in the column is floor: it ends the piece above it. */
    if (run.length && run[run.length - 1].row !== c.row + 1) flush();
    run.push(c);
    if (run.length === want) flush();
    if (i === cells.length - 1) flush();
  });
});

let dropEnd = 0;
pieces.forEach((p) => {
  p.delay = p.col * STAGGER + p.index * PIECE_GAP;
  /*
   * Rows travelled, measured so the piece's lowest cell starts above snk's
   * canvas top (vy) - held any lower and it would hang visibly in the lane
   * the snake idles in.
   */
  const deepest = Math.max(...p.cells.map((c) => c.row));
  p.rows = deepest + Math.ceil((minY - vy) / pitch) + LEAD;
  dropEnd = Math.max(dropEnd, p.delay + p.rows * STEP);
});

const intro = dropEnd + SETTLE;
const D = intro * 1000 + cycle;
const at = (sec) => +(((sec * 1000) / D) * 100).toFixed(4);

/* ------------------------------------------- re-time snk, splice the drop */

/*
 * Shift every keyframe percentage in snk's stylesheet so its game plays in the
 * back portion of the stretched cycle. Selectors are the only place a
 * percentage appears inside these blocks, always followed by "," or "{".
 */
const shift = (p) => +(((intro * 1000 + (p / 100) * cycle) / D) * 100).toFixed(4);
style = style.replace(/@keyframes [\w-]+\{(?:[^{}]*\{[^{}]*\})+\}/g, (block) =>
  block.replace(/([\d.]+)%(?=[,{])/g, (_, p) => `${shift(Number(p))}%`),
);
style = style.replace(new RegExp(`${cycle}ms`, "g"), `${Math.round(D)}ms`);

/* The drop itself: one keyframes per piece, every cell riding its group. */
const dropCss = [];
pieces.forEach((p, k) => {
  const stops = [`0%,${at(p.delay)}%{transform:translateY(-${p.rows * pitch}px)}`];
  for (let s = 1; s < p.rows; s++) {
    stops.push(`${at(p.delay + s * STEP)}%{transform:translateY(-${(p.rows - s) * pitch}px)}`);
  }
  const land = p.delay + p.rows * STEP;
  stops.push(`${at(land)}%{transform:translateY(0);filter:brightness(2)}`);
  stops.push(`${at(land + 0.12)}%,100%{transform:translateY(0);filter:brightness(1)}`);
  dropCss.push(`@keyframes d${k}{${stops.join("")}}`);

  p.cells.forEach((c) => {
    body = body.replace(c.tag, `<g style="animation:d${k} ${Math.round(D)}ms step-end infinite">${c.tag}</g>`);
  });
});

/* --------------------------------------------------------- our cabinet */

const cal = await fetchCalendar(USER);
const s = stats(cal);

const wellX = PAD + LABEL_W;
const wellY = PAD;
const wellW = vw + INSET * 2;
const wellH = vh + INSET * 2;
const WIDTH = wellX + wellW + PAD + 14;

const monthY = wellY + wellH + 13;
const hudY = monthY + 8;
const contentHeight = hudY + HUD_H + PAD;

/* Grid coordinates in snk space, mapped onto the page. */
const gx = (u) => wellX + INSET + (u - vx);
const gy = (u) => wellY + INSET + (u - vy);

const months = monthMarks(cal.weeks)
  .map((m) => `<text x="${gx(minX + m.week * pitch)}" y="${monthY}" font-family="${MONO}" font-size="9" fill="${T.faint}">${m.label}</text>`)
  .join("");

const dayLabels = [[1, "Mon"], [3, "Wed"], [5, "Fri"]]
  .map(([wd, name]) => `<text x="${wellX - 7}" y="${gy(minY + wd * pitch) + 10}" font-family="${MONO}" font-size="9" fill="${T.faint}" text-anchor="end">${name}</text>`)
  .join("");

const boxW = Math.floor((wellW - HUD_GAP * 3) / 4);
const hud =
  statBox(wellX, hudY, boxW, HUD_H, "SCORE", String(s.score)) +
  statBox(wellX + (boxW + HUD_GAP), hudY, boxW, HUD_H, "LINES", String(s.lines)) +
  statBox(wellX + (boxW + HUD_GAP) * 2, hudY, boxW, HUD_H, "LEVEL", String(s.level)) +
  nextBox(wellX + (boxW + HUD_GAP) * 3, hudY, boxW, HUD_H);

/*
 * snk rides inside as a nested svg with its original viewBox, so its viewport
 * does the clipping: a held piece sits above vy and simply is not drawn.
 */
const board =
  `<svg x="${wellX + INSET}" y="${wellY + INSET}" width="${vw}" height="${vh}" viewBox="${vx} ${vy} ${vw} ${vh}">` +
  `<style>${style}\n${dropCss.join("\n")}</style>${body}</svg>`;

const out = windowFrame({
  width: WIDTH,
  contentHeight,
  title: `${USER}@github: ~/contributions`,
  body: `${plate(wellX, wellY, wellW, wellH)}\n${board}\n${months}${dayLabels}${hud}`,
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out);
console.log(
  `${OUT} - ${animated.length} cells in ${pieces.length} pieces, intro ${intro.toFixed(2)}s, cycle ${(D / 1000).toFixed(1)}s (snk ${cycle}ms)`,
);
