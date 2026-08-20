/**
 * The window chrome the profile SVGs are drawn inside.
 *
 * These images sit under a README, not inside the site, so they cannot read the
 * app's CSS custom properties - the palette below is the Motif preset
 * (globals.css `.motif`, the site's default) resolved to hex: navy primary on
 * warm-grey chrome, white bevel highlights, the OSF/1 look. The frame is the
 * same window Window.tsx draws: a bevel-out shell, an active titlebar, and a
 * bevel-in well for the content.
 */

export const T = {
  desktop: "#4a6076",
  card: "#d6d3ce",
  secondary: "#d6d3ce",
  foreground: "#1a1a1a",
  muted: "#4a4a4a",
  faint: "#5d5b58",
  accent: "#000080",
  accentInk: "#000080",
  onAccent: "#ffffff",
  bevelLight: "#ffffff",
  bevelDark: "#6e6b66",
};

/** Space Mono is a webfont; an SVG behind GitHub's image proxy cannot load one. */
export const MONO =
  "ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,DejaVu Sans Mono,monospace";
export const UI = "Helvetica,Arial,system-ui,sans-serif";

/** Advance width of one glyph at a given size, for the mono stacks above. */
export const CH = 0.6;
export const chars = (n, size) => n * size * CH;

const TITLEBAR = 25;
const PAD = 5;

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

function button(x, y, glyph, dy = 0) {
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
export function windowFrame({ width, contentHeight, title, body, defs = "", extraStyle = "" }) {
  const height = TITLEBAR + contentHeight + PAD * 2 + 2;
  const wellY = TITLEBAR + PAD;
  const wellW = width - PAD * 2;
  const btnY = 4;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">
<defs>
${defs}
</defs>
<style>
  text { font-kerning: none; }
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; }
  }
${extraStyle}
</style>
<rect width="${width}" height="${height}" fill="${T.secondary}"/>
${bevel(0, 0, width, height, T.bevelLight, T.bevelDark)}
<rect x="${PAD - 3}" y="2" width="${width - (PAD - 3) * 2}" height="${TITLEBAR - 4}" fill="${T.accent}"/>
<text x="${PAD + 2}" y="${TITLEBAR - 8}" font-family="${UI}" font-size="13" font-weight="bold" fill="${T.onAccent}">${esc(title)}</text>
${button(width - 62, btnY, "_", 2)}
${button(width - 42, btnY, "□")}
${button(width - 22, btnY, "×", 1)}
${bevel(PAD, wellY, wellW, contentHeight + PAD, T.bevelDark, T.bevelLight)}
<rect x="${PAD + 2}" y="${wellY + 2}" width="${wellW - 4}" height="${contentHeight + PAD - 4}" fill="${T.card}"/>
<svg x="${PAD + 2}" y="${wellY + 2}" width="${wellW - 4}" height="${contentHeight + PAD - 4}" overflow="hidden">
${body}
</svg>
</svg>`;
}
