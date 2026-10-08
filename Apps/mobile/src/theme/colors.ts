/**
 * The site's colours (src/app/globals.css) for React Native, which has no
 * oklch(): the same tokens, light and dark, with the primary hue `h` and the
 * neutral hue `n` of each colour style (src/lib/palettes.ts), turned into sRGB.
 */
import type { PaletteId } from "@lib/palettes";

/** OKLCH lightness 0–1, chroma, hue in degrees, and an alpha. */
export type Oklch = { l: number; c: number; h: number; a?: number };

/** The hues globals.css gives each colour style (`--h`, `--n`). */
const HUES: Record<PaletteId, { h: number; n: number }> = {
  emerald: { h: 166, n: 95 },
  turquoise: { h: 205, n: 200 },
  night: { h: 258, n: 250 },
  violet: { h: 305, n: 300 },
  garnet: { h: 15, n: 40 },
  sand: { h: 65, n: 80 },
};

const ok = (l: number, c: number, h: number, a?: number): Oklch => ({ l, c, h, a });

function tokens(dark: boolean, { h, n }: { h: number; n: number }) {
  return dark
    ? {
        background: ok(0.17, 0.012, h),
        foreground: ok(0.96, 0.008, n),
        card: ok(0.215, 0.014, h),
        primary: ok(0.74, 0.12, h),
        primaryForeground: ok(0.2, 0.04, h),
        secondary: ok(0.27, 0.02, h),
        secondaryForeground: ok(0.93, 0.02, h),
        muted: ok(0.26, 0.014, h),
        mutedForeground: ok(0.72, 0.015, h),
        accent: ok(0.28, 0.025, h),
        accentForeground: ok(0.95, 0.02, h),
        destructive: ok(0.704, 0.191, 22.216),
        border: ok(1, 0, 0, 0.1),
        input: ok(1, 0, 0, 0.15),
        ring: ok(0.6, 0.1, h),
        gold: ok(0.8, 0.11, 85),
      }
    : {
        background: ok(0.99, 0.004, n),
        foreground: ok(0.2, 0.015, h),
        card: ok(1, 0, 0),
        primary: ok(0.46, 0.095, h),
        primaryForeground: ok(0.985, 0.01, h),
        secondary: ok(0.96, 0.014, h),
        secondaryForeground: ok(0.3, 0.06, h),
        muted: ok(0.965, 0.006, n),
        mutedForeground: ok(0.5, 0.015, n),
        accent: ok(0.955, 0.02, h),
        accentForeground: ok(0.3, 0.06, h),
        destructive: ok(0.577, 0.245, 27.325),
        border: ok(0.915, 0.008, n),
        input: ok(0.9, 0.008, n),
        ring: ok(0.62, 0.1, h),
        gold: ok(0.7, 0.12, 80),
      };
}

export type TokenName = keyof ReturnType<typeof tokens>;
export type Colors = Record<TokenName, string>;

/** CSS color-mix(in oklch, a p%, b): `p` of `a`, the hue the short way round (a grey takes the other's hue). */
export function mix(a: Oklch, b: Oklch, p: number): Oklch {
  const q = 1 - p;
  let ha = a.h;
  let hb = b.h;
  if (a.c === 0) ha = hb;
  if (b.c === 0) hb = ha;
  let d = hb - ha;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return { l: a.l * p + b.l * q, c: a.c * p + b.c * q, h: ha + d * q, a: (a.a ?? 1) * p + (b.a ?? 1) * q };
}

/** The colour with this alpha (CSS color-mix with transparent). */
export const alpha = (c: Oklch, a: number): Oklch => ({ ...c, a: (c.a ?? 1) * a });

/** OKLCH → an sRGB CSS string RN understands (#rrggbb, or rgba() with an alpha). */
export function css({ l, c, h, a = 1 }: Oklch): string {
  const hr = (h * Math.PI) / 180;
  const A = c * Math.cos(hr);
  const B = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  const [r, g, b] = lin.map((x) => {
    const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  });
  if (a >= 1) return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  return `rgba(${r},${g},${b},${Math.round(a * 1000) / 1000})`;
}

export type Theme = {
  dark: boolean;
  palette: PaletteId;
  /** The tokens as OKLCH, for mixing (the floating bar's looks). */
  raw: ReturnType<typeof tokens>;
  colors: Colors;
};

const cache = new Map<string, Theme>();

export function makeTheme(dark: boolean, palette: PaletteId): Theme {
  const key = `${dark}:${palette}`;
  let t = cache.get(key);
  if (!t) {
    const raw = tokens(dark, HUES[palette]);
    const colors = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, css(v)])) as Colors;
    t = { dark, palette, raw, colors };
    cache.set(key, t);
  }
  return t;
}
