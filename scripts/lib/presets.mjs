/**
 * The portfolio's four desktop presets, resolved to hex.
 *
 * globals.css holds these as HSL custom properties, which an SVG behind
 * GitHub's image proxy cannot read - so they are resolved here, and the ids
 * match the ones in lib/theme/presets.ts so the site can pick a file by the
 * preset it is already wearing.
 *
 * `chrome` is our window and panel furniture. `board` is what gets written
 * over snk's `:root`: it publishes every colour as a custom property, so one
 * generated snake can be dressed four ways without regenerating it.
 */

export const PRESETS = [
  {
    id: "motif",
    name: "Motif",
    chrome: {
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
    },
    board: {
      well: "#ffffff",
      edge: "#7a7773",
      edgeIn: "#d6d3ce",
      /* Empty, then the four quartiles, ending on the preset's primary. */
      ramp: ["#e9eaf0", "#b9c0e0", "#7c88c4", "#3a49a4", "#000080"],
      /* The theme's destructive: the one hue that is never the board's own. */
      snake: "#b12626",
    },
  },
  {
    id: "cde",
    name: "CDE",
    chrome: {
      card: "#dcdde4",
      secondary: "#b0b2c0",
      foreground: "#14161c",
      muted: "#3d4150",
      faint: "#43454f",
      accent: "#467099",
      accentInk: "#30506e",
      onAccent: "#ffffff",
      bevelLight: "#dcdde4",
      bevelDark: "#5f6675",
    },
    board: {
      well: "#dcdde4",
      edge: "#5f6675",
      edgeIn: "#b0b2c0",
      ramp: ["#c7c9d3", "#9aa9bd", "#7089a5", "#4c7396", "#2b5a80"],
      snake: "#832121",
    },
  },
  {
    id: "tango",
    name: "Console",
    chrome: {
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
    },
    board: {
      well: "#0d100c",
      edge: "#37650a",
      edgeIn: "#26400a",
      ramp: ["#171c14", "#26400a", "#37650a", "#4e9a06", "#79d21a"],
      snake: "#e87a7a",
    },
  },
  {
    id: "twm",
    name: "twm",
    chrome: {
      card: "#ffffff",
      secondary: "#ffffff",
      foreground: "#000000",
      muted: "#333333",
      faint: "#767676",
      accent: "#000000",
      accentInk: "#000000",
      onAccent: "#ffffff",
      bevelLight: "#000000",
      bevelDark: "#000000",
    },
    board: {
      well: "#ffffff",
      edge: "#000000",
      edgeIn: "#8a8a8a",
      /* X11R5 had no colour to spend, so this is a value ramp. */
      ramp: ["#ffffff", "#c4c4c4", "#8a8a8a", "#4a4a4a", "#000000"],
      /* Nothing in twm is coloured; the snake reads by being the one fill
       * that is neither a grey step nor the page. */
      snake: "#8a8a8a",
    },
  },
];

export const presetById = (id) => PRESETS.find((p) => p.id === id) ?? PRESETS[0];

/**
 * snk's palette block, rewritten for a preset.
 *
 * snk publishes every colour it uses as a custom property on `:root`, so
 * swapping this one declaration redresses its board, its snake and its meter
 * without touching a single element or regenerating the animation.
 */
export function rootFor(preset) {
  const { ramp, snake } = preset.board;
  return (
    `:root{--cb:#1b1f2308;--cs:${snake};--ce:${ramp[0]};` +
    ramp.map((c, i) => `--c${i}:${c}`).join(";") +
    `}`
  );
}
