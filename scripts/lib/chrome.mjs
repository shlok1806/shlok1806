/**
 * The window chrome the profile SVGs are drawn inside.
 *
 * These images sit under a README, not inside the site, so they cannot read the
 * app's CSS custom properties - the palettes live resolved to hex in
 * presets.mjs, and a caller passes the one it wants as `T`. The frame is the
 * same window Window.tsx draws: a bevel-out shell, an active titlebar, and a
 * bevel-in well for the content.
 */

import { PRESETS } from "./presets.mjs";

/** The default set, for callers that do not name a preset. */
export const T = PRESETS[0].chrome;

/** Space Mono is a webfont; an SVG behind GitHub's image proxy cannot load one. */
export const MONO =
  "ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,DejaVu Sans Mono,monospace";
export const UI = "Helvetica,Arial,system-ui,sans-serif";

/** Advance width of one glyph at a given size, for the mono stacks above. */
export const CH = 0.6;
export const chars = (n, size) => n * size * CH;

const TITLEBAR = 25;
const PAD = 5;

const BASE_STYLE = `  text { font-kerning: none; }
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; }
  }`;

/** The content viewport windowFrame hands a body, given the window's width. */
export const viewWidth = (width) => width - PAD * 2 - 4;

export function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c],
  );
}

/** Truncate to n glyphs, keeping the tail readable with an ellipsis. */
export function fit(s, n) {
  const t = String(s);
  return t.length <= n ? t : t.slice(0, Math.max(0, n - 1)) + "…";
}

function bevel(x, y, w, h, light, dark) {
  return (
    `<path d="M${x},${y + h} L${x},${y} L${x + w},${y} L${x + w - 2},${y + 2} L${x + 2},${y + 2} L${x + 2},${y + h - 2} Z" fill="${light}"/>` +
    `<path d="M${x + w},${y} L${x + w},${y + h} L${x},${y + h} L${x + 2},${y + h - 2} L${x + w - 2},${y + h - 2} L${x + w - 2},${y + 2} Z" fill="${dark}"/>`
  );
}

function button(x, y, glyph, dy, T) {
  return (
    `<g>${bevel(x, y, 17, 17, T.bevelLight, T.bevelDark)}` +
    `<rect x="${x + 2}" y="${y + 2}" width="13" height="13" fill="${T.secondary}"/>` +
    `<text x="${x + 8.5}" y="${y + 12 + dy}" font-family="${UI}" font-size="10" fill="${T.foreground}" text-anchor="middle">${glyph}</text></g>`
  );
}

/**
 * Wrap `body` in the window. `body` is drawn with the content well's top-left
 * as its origin, so callers lay out from (0,0) and ignore the frame.
 */
export function windowFrame({ width, contentHeight, title, body, theme = T, defs = "", extraStyle = "" }) {
  const height = TITLEBAR + contentHeight + PAD * 2 + 2;
  const wellY = TITLEBAR + PAD;
  const wellW = width - PAD * 2;
  const btnY = 4;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">
<defs>
${defs}
</defs>
<style>
${BASE_STYLE}
${extraStyle}
</style>
<rect width="${width}" height="${height}" fill="${theme.secondary}"/>
${bevel(0, 0, width, height, theme.bevelLight, theme.bevelDark)}
<rect x="${PAD - 3}" y="2" width="${width - (PAD - 3) * 2}" height="${TITLEBAR - 4}" fill="${theme.accent}"/>
<text x="${PAD + 2}" y="${TITLEBAR - 8}" font-family="${UI}" font-size="13" font-weight="bold" fill="${theme.onAccent}">${esc(title)}</text>
${button(width - 62, btnY, "_", 2, theme)}
${button(width - 42, btnY, "□", 0, theme)}
${button(width - 22, btnY, "×", 1, theme)}
${bevel(PAD, wellY, wellW, contentHeight + PAD, theme.bevelDark, theme.bevelLight)}
<rect x="${PAD + 2}" y="${wellY + 2}" width="${wellW - 4}" height="${contentHeight + PAD - 4}" fill="${theme.card}"/>
<svg x="${PAD + 2}" y="${wellY + 2}" width="${wellW - 4}" height="${contentHeight + PAD - 4}" overflow="hidden">
${body}
</svg>
</svg>`;
}

/**
 * The same content with no window around it, sized to the content viewport.
 *
 * For surfaces that draw their own chrome - the portfolio's window manager
 * already gives this a title bar it can drag and a corner it can resize, and
 * nesting our painted frame inside a real one reads as a window in a window.
 * Body coordinates are identical either way, so a caller swaps one for the
 * other without touching its layout.
 *
 * Deliberately no background: the host paints it. The portfolio repaints its
 * window surfaces per desktop preset, and a fixed fill here would show as a
 * patch of the wrong grey on three of the four.
 */
export function bareFrame({ width, contentHeight, label, body, defs = "", extraStyle = "" }) {
  const w = viewWidth(width);
  const h = contentHeight + PAD - 4;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
<defs>
${defs}
</defs>
<style>
${BASE_STYLE}
${extraStyle}
</style>
${body}
</svg>`;
}
