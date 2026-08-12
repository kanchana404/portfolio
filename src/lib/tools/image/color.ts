/**
 * Colour parsing, conversion and contrast.
 *
 * Two decisions worth stating up front.
 *
 * **Contrast is computed, not looked up.** The WCAG ratio is a specific formula
 * over relative luminance in *linearised* sRGB. Averaging the channels, or using
 * HSL lightness as a stand-in, gives a number that looks plausible and fails a
 * real audit. The gamma expansion below is the part people skip.
 *
 * **OKLCH is included because it is the one that behaves.** Two HSL colours with
 * the same `L` can differ wildly in perceived brightness — `hsl(60 100% 50%)` is
 * blinding yellow and `hsl(240 100% 50%)` is near-black blue, at identical
 * "lightness". OKLCH is perceptually uniform, which is why CSS Color 4 added it
 * and why it is the right space to build a palette in.
 */

export interface Rgb {
  r: number; // 0–255
  g: number;
  b: number;
  a: number; // 0–1
}

export interface Hsl {
  h: number; // 0–360
  s: number; // 0–100
  l: number; // 0–100
  a: number;
}

export interface Oklch {
  l: number; // 0–1
  c: number;
  h: number; // 0–360
  a: number;
}

/**
 * The CSS named colours, packed as one string.
 *
 * A partial list is worse than none — "why does `tomato` work but
 * `rebeccapurple` not?" is a bug report waiting to happen. The whole set stored
 * this way costs about a kilobyte before compression and gzips down hard,
 * because the payload is almost entirely repeated hex digits.
 */
const NAMED =
  "aliceblue f0f8ff,antiquewhite faebd7,aqua 00ffff,aquamarine 7fffd4,azure f0ffff," +
  "beige f5f5dc,bisque ffe4c4,black 000000,blanchedalmond ffebcd,blue 0000ff," +
  "blueviolet 8a2be2,brown a52a2a,burlywood deb887,cadetblue 5f9ea0,chartreuse 7fff00," +
  "chocolate d2691e,coral ff7f50,cornflowerblue 6495ed,cornsilk fff8dc,crimson dc143c," +
  "cyan 00ffff,darkblue 00008b,darkcyan 008b8b,darkgoldenrod b8860b,darkgray a9a9a9," +
  "darkgreen 006400,darkgrey a9a9a9,darkkhaki bdb76b,darkmagenta 8b008b," +
  "darkolivegreen 556b2f,darkorange ff8c00,darkorchid 9932cc,darkred 8b0000," +
  "darksalmon e9967a,darkseagreen 8fbc8f,darkslateblue 483d8b,darkslategray 2f4f4f," +
  "darkslategrey 2f4f4f,darkturquoise 00ced1,darkviolet 9400d3,deeppink ff1493," +
  "deepskyblue 00bfff,dimgray 696969,dimgrey 696969,dodgerblue 1e90ff,firebrick b22222," +
  "floralwhite fffaf0,forestgreen 228b22,fuchsia ff00ff,gainsboro dcdcdc," +
  "ghostwhite f8f8ff,gold ffd700,goldenrod daa520,gray 808080,green 008000," +
  "greenyellow adff2f,grey 808080,honeydew f0fff0,hotpink ff69b4,indianred cd5c5c," +
  "indigo 4b0082,ivory fffff0,khaki f0e68c,lavender e6e6fa,lavenderblush fff0f5," +
  "lawngreen 7cfc00,lemonchiffon fffacd,lightblue add8e6,lightcoral f08080," +
  "lightcyan e0ffff,lightgoldenrodyellow fafad2,lightgray d3d3d3,lightgreen 90ee90," +
  "lightgrey d3d3d3,lightpink ffb6c1,lightsalmon ffa07a,lightseagreen 20b2aa," +
  "lightskyblue 87cefa,lightslategray 778899,lightslategrey 778899,lightsteelblue b0c4de," +
  "lightyellow ffffe0,lime 00ff00,limegreen 32cd32,linen faf0e6,magenta ff00ff," +
  "maroon 800000,mediumaquamarine 66cdaa,mediumblue 0000cd,mediumorchid ba55d3," +
  "mediumpurple 9370db,mediumseagreen 3cb371,mediumslateblue 7b68ee," +
  "mediumspringgreen 00fa9a,mediumturquoise 48d1cc,mediumvioletred c71585," +
  "midnightblue 191970,mintcream f5fffa,mistyrose ffe4e1,moccasin ffe4b5," +
  "navajowhite ffdead,navy 000080,oldlace fdf5e6,olive 808000,olivedrab 6b8e23," +
  "orange ffa500,orangered ff4500,orchid da70d6,palegoldenrod eee8aa,palegreen 98fb98," +
  "paleturquoise afeeee,palevioletred db7093,papayawhip ffefd5,peachpuff ffdab9," +
  "peru cd853f,pink ffc0cb,plum dda0dd,powderblue b0e0e6,purple 800080," +
  "rebeccapurple 663399,red ff0000,rosybrown bc8f8f,royalblue 4169e1," +
  "saddlebrown 8b4513,salmon fa8072,sandybrown f4a460,seagreen 2e8b57,seashell fff5ee," +
  "sienna a0522d,silver c0c0c0,skyblue 87ceeb,slateblue 6a5acd,slategray 708090," +
  "slategrey 708090,snow fffafa,springgreen 00ff7f,steelblue 4682b4,tan d2b48c," +
  "teal 008080,thistle d8bfd8,tomato ff6347,turquoise 40e0d0,violet ee82ee," +
  "wheat f5deb3,white ffffff,whitesmoke f5f5f5,yellow ffff00,yellowgreen 9acd32";

let namedMap: Map<string, string> | null = null;

function namedColors(): Map<string, string> {
  // Built on first use, not at import, so a page that never resolves a name
  // never pays for the map.
  if (!namedMap) {
    namedMap = new Map(
      NAMED.split(",").map((entry) => {
        const [name, hex] = entry.split(" ");
        return [name, hex] as const;
      })
    );
  }
  return namedMap;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const round = (value: number, places = 0): number => {
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
};

/**
 * Parse anything a person is likely to paste.
 *
 * Returns null rather than a default colour on failure: silently falling back to
 * black would make a typo look like a successful conversion.
 */
export function parseColor(input: string): Rgb | null {
  const text = input.trim().toLowerCase();
  if (text.length === 0) return null;

  if (text === "transparent") return { r: 0, g: 0, b: 0, a: 0 };

  const named = namedColors().get(text);
  if (named) return parseHex(`#${named}`);

  if (text.startsWith("#")) return parseHex(text);

  // Bare hex without the hash — very common when copying out of a design tool.
  if (/^[0-9a-f]{3,8}$/.test(text) && [3, 4, 6, 8].includes(text.length)) {
    return parseHex(`#${text}`);
  }

  const fn = /^(rgba?|hsla?|oklch)\s*\(([^)]*)\)$/.exec(text);
  if (!fn) return null;

  // Both the legacy comma syntax and the modern space syntax with an optional
  // `/ alpha` are in the wild; normalise before splitting.
  const parts = fn[2]
    .replace(/\//g, " / ")
    .split(/[\s,]+/)
    .filter((p) => p.length > 0);

  const alphaIndex = parts.indexOf("/");
  const values = alphaIndex === -1 ? parts : parts.slice(0, alphaIndex);
  const alphaToken = alphaIndex === -1 ? values[3] : parts[alphaIndex + 1];
  const alpha = alphaToken === undefined ? 1 : parseAlpha(alphaToken);
  if (alpha === null) return null;

  const kind = fn[1];

  if (kind === "rgb" || kind === "rgba") {
    if (values.length < 3) return null;
    const channels = values.slice(0, 3).map((v) =>
      v.endsWith("%") ? (parseFloat(v) / 100) * 255 : parseFloat(v)
    );
    if (channels.some((c) => !Number.isFinite(c))) return null;
    return {
      r: clamp(Math.round(channels[0]), 0, 255),
      g: clamp(Math.round(channels[1]), 0, 255),
      b: clamp(Math.round(channels[2]), 0, 255),
      a: alpha,
    };
  }

  if (kind === "hsl" || kind === "hsla") {
    if (values.length < 3) return null;
    const h = parseHue(values[0]);
    const s = parseFloat(values[1]);
    const l = parseFloat(values[2]);
    if (h === null || !Number.isFinite(s) || !Number.isFinite(l)) return null;
    return hslToRgb({ h, s: clamp(s, 0, 100), l: clamp(l, 0, 100), a: alpha });
  }

  // oklch(L C H)
  if (values.length < 3) return null;
  const l = values[0].endsWith("%") ? parseFloat(values[0]) / 100 : parseFloat(values[0]);
  const c = parseFloat(values[1]);
  const h = parseHue(values[2]);
  if (!Number.isFinite(l) || !Number.isFinite(c) || h === null) return null;
  return oklchToRgb({ l: clamp(l, 0, 1), c: Math.max(0, c), h, a: alpha });
}

function parseAlpha(token: string): number | null {
  const value = token.endsWith("%") ? parseFloat(token) / 100 : parseFloat(token);
  return Number.isFinite(value) ? clamp(value, 0, 1) : null;
}

function parseHue(token: string): number | null {
  const value = parseFloat(token.replace(/deg$/, ""));
  if (!Number.isFinite(value)) return null;
  return ((value % 360) + 360) % 360;
}

export function parseHex(hex: string): Rgb | null {
  const body = hex.replace(/^#/, "");
  if (!/^[0-9a-f]+$/i.test(body)) return null;

  const expand = (s: string): string => s.split("").map((c) => c + c).join("");

  let full: string;
  if (body.length === 3) full = expand(body) + "ff";
  else if (body.length === 4) full = expand(body);
  else if (body.length === 6) full = body + "ff";
  else if (body.length === 8) full = body;
  else return null;

  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    a: round(parseInt(full.slice(6, 8), 16) / 255, 3),
  };
}

export function rgbToHex(rgb: Rgb, includeAlpha = false): string {
  const hex = (n: number): string =>
    clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  const base = `#${hex(rgb.r)}${hex(rgb.g)}${hex(rgb.b)}`;
  // `includeAlpha` decides this on its own. The old guard also returned early on
  // `rgb.a >= 1`, which meant a translucent colour appended alpha even when the
  // caller had asked for six digits — and the callers that ask for six digits
  // are `<input type="color">`, which silently resets to #000000 on a 9-char
  // value. Alpha is opt-in, never inferred.
  return includeAlpha ? `${base}${hex(rgb.a * 255)}` : base;
}

export function rgbToHsl(rgb: Rgb): Hsl {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h: round(h, 1), s: round(s * 100, 1), l: round(l * 100, 1), a: rgb.a };
}

export function hslToRgb(hsl: Hsl): Rgb {
  const h = ((hsl.h % 360) + 360) % 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
    a: hsl.a,
  };
}

/** sRGB gamma expansion — the step that makes contrast maths correct. */
function linearise(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function delinearise(channel: number): number {
  const c =
    channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
  return clamp(Math.round(c * 255), 0, 255);
}

export function rgbToOklch(rgb: Rgb): Oklch {
  const r = linearise(rgb.r);
  const g = linearise(rgb.g);
  const b = linearise(rgb.b);

  const lm = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const sm = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * lm + 0.793617785 * mm - 0.0040720468 * sm;
  const A = 1.9779984951 * lm - 2.428592205 * mm + 0.4505937099 * sm;
  const B = 0.0259040371 * lm + 0.7827717662 * mm - 0.808675766 * sm;

  const c = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;

  return {
    l: round(L, 4),
    c: round(c, 4),
    // Hue is meaningless at zero chroma; report 0 rather than atan2 noise.
    h: c < 1e-4 ? 0 : round(h, 1),
    a: rgb.a,
  };
}

export function oklchToRgb(oklch: Oklch): Rgb {
  const hr = (oklch.h * Math.PI) / 180;
  const A = oklch.c * Math.cos(hr);
  const B = oklch.c * Math.sin(hr);

  const lm = oklch.l + 0.3963377774 * A + 0.2158037573 * B;
  const mm = oklch.l - 0.1055613458 * A - 0.0638541728 * B;
  const sm = oklch.l - 0.0894841775 * A - 1.291485548 * B;

  const l = lm * lm * lm;
  const m = mm * mm * mm;
  const s = sm * sm * sm;

  return {
    r: delinearise(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: delinearise(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: delinearise(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: oklch.a,
  };
}

export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * linearise(rgb.r) + 0.7152 * linearise(rgb.g) + 0.0722 * linearise(rgb.b)
  );
}

/**
 * WCAG 2.x contrast ratio, from 1 (identical) to 21 (black on white).
 *
 * Alpha is ignored deliberately. A translucent colour has no single contrast
 * ratio — it depends on whatever is behind it — and quietly compositing against
 * an assumed white background would produce a confident, wrong number.
 */
/**
 * The unrounded ratio. Every pass/fail comparison must use this, never the
 * display value — see `contrastRatio`.
 */
function exactContrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * The ratio as displayed, to 2dp.
 *
 * Truncated rather than rounded, because rounding can only ever move a value
 * *up* across a threshold: #168484 on white is 4.4988…, which rounds to a
 * displayed "4.5" for a pairing that fails WCAG's `>= 4.5`. Truncating gives
 * 4.49, so the number a user reads never claims more contrast than exists.
 * Black on white is exactly 21 and identical colours exactly 1, so neither
 * boundary is disturbed.
 */
export function contrastRatio(a: Rgb, b: Rgb): number {
  return Math.floor(exactContrastRatio(a, b) * 100) / 100;
}

export interface ContrastVerdict {
  ratio: number;
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
  /** Non-text UI components and graphical objects, WCAG 1.4.11. */
  uiComponents: boolean;
  summary: string;
}

export function checkContrast(foreground: Rgb, background: Rgb): ContrastVerdict {
  // Thresholds compare against the exact ratio, never the 2dp display value.
  // Comparing the rounded number made 4.4988… report "Passes AA", green-lighting
  // a pairing that a real audit fails. The affected bands are thin —
  // [4.495, 4.5), [2.995, 3), [6.995, 7) — but this is the one claim the tool
  // exists to make, to people who will act on it.
  const exact = exactContrastRatio(foreground, background);
  const ratio = contrastRatio(foreground, background);
  const aaNormal = exact >= 4.5;
  const aaLarge = exact >= 3;
  const aaaNormal = exact >= 7;

  const summary = aaaNormal
    ? "Passes everything, including AAA for body text."
    : aaNormal
      ? "Passes AA at any size, and AAA for large text."
      : aaLarge
        ? "Only passes for large text — 18.66px bold, or 24px regular, and up."
        : "Fails at every text size. This pairing is not accessible.";

  return {
    ratio,
    aaNormal,
    aaLarge,
    aaaNormal,
    aaaLarge: exact >= 4.5,
    uiComponents: exact >= 3,
    summary,
  };
}

export interface ColorFormats {
  hex: string;
  hexAlpha: string;
  rgb: string;
  hsl: string;
  oklch: string;
}

export function formatAll(rgb: Rgb): ColorFormats {
  const hsl = rgbToHsl(rgb);
  const oklch = rgbToOklch(rgb);
  const alpha = round(rgb.a, 3);

  return {
    hex: rgbToHex(rgb),
    hexAlpha: rgbToHex(rgb, true),
    rgb:
      alpha >= 1
        ? `rgb(${rgb.r} ${rgb.g} ${rgb.b})`
        : `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${alpha})`,
    hsl:
      alpha >= 1
        ? `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`
        : `hsl(${hsl.h} ${hsl.s}% ${hsl.l}% / ${alpha})`,
    oklch:
      alpha >= 1
        ? `oklch(${round(oklch.l * 100, 2)}% ${oklch.c} ${oklch.h})`
        : `oklch(${round(oklch.l * 100, 2)}% ${oklch.c} ${oklch.h} / ${alpha})`,
  };
}

/**
 * Tints and shades, stepped in OKLCH.
 *
 * Doing this in HSL is the usual approach and the reason so many generated
 * palettes have a muddy middle: equal lightness steps in HSL are not equal
 * perceptual steps. Stepping `L` in OKLCH gives a ramp that reads evenly.
 */
export function buildScale(rgb: Rgb, steps = 9): Array<{ step: number; hex: string }> {
  const base = rgbToOklch(rgb);
  const out: Array<{ step: number; hex: string }> = [];
  for (let i = 0; i < steps; i++) {
    const l = 0.95 - (i * 0.9) / (steps - 1);
    // Chroma is tapered at the extremes, where high chroma falls outside sRGB
    // and would clip to a flat, wrong colour.
    const taper = 1 - Math.abs(l - 0.55) / 0.55;
    const c = base.c * clamp(0.35 + taper * 0.65, 0, 1);
    out.push({
      step: (i + 1) * 100,
      hex: rgbToHex(oklchToRgb({ l, c, h: base.h, a: 1 })),
    });
  }
  return out;
}
