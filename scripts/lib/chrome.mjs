/**
 * The window chrome the profile SVGs are drawn inside.
 *
 * These images sit under a README, not inside the site, so they cannot read the
 * app's CSS custom properties - the palette below is the Console preset
 * (globals.css `.tango`) resolved to hex, and the frame is the same twm window
 * Window.tsx draws: a bevel-out shell, an active titlebar, and a bevel-in well
 * for the content.
 */

export const T = {
  desktop: "#1c1f20",
  card: "#101314",
  secondary: "#2e3436",
  foreground: "#d3d7cf",
  muted: "#a9aca6",
  faint: "#959c98",
  accent: "#4e9a06",
  accentInk: "#58af06",
  onAccent: "#0c0f0b",
  bevelLight: "#555753",
  bevelDark: "#141718",
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
<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
  <rect width="4" height="1" fill="#000" opacity="0.10"/>
</pattern>
<radialGradient id="vig" cx="50%" cy="50%" r="75%">
  <stop offset="55%" stop-color="#000" stop-opacity="0"/>
  <stop offset="100%" stop-color="#000" stop-opacity="0.25"/>
</radialGradient>
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
<rect width="100%" height="100%" fill="url(#scan)" pointer-events="none"/>
<rect width="100%" height="100%" fill="url(#vig)" pointer-events="none"/>
</svg>
</svg>`;
}
