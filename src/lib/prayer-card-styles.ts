/**
 * Looks for the prayer times image (src/lib/images/prayer-card.ts): a
 * channel's «مواقيت الصلاة» post (content `style`) and the site's /prayer
 * «صورة المواقيت». «أخضر» is the original one and the default. Client-safe.
 */
export type PrayerCardTheme = {
  /** Background gradient, top to bottom. */
  bg: [string, string];
  /** The faint pattern over it: a star lattice, or a night sky. */
  pattern: { kind: "lattice"; color: string } | { kind: "stars" };
  /** The big words (title, prayer names). */
  text: string;
  /** Dates, the ayah reference, the footer. */
  soft: string;
  /** Stars, the city, the ayah, the highlighted time. */
  accent: string;
  /** A time row, and Friday's (highlighted) one. */
  panel: string;
  panelStrong: string;
  panelBorder: string;
  /** Darken the edges (on dark backgrounds). */
  vignette: boolean;
  /** Rows (a list), or tiles in a 2×3 grid. */
  layout: "rows" | "tiles";
};

export const PRAYER_CARD_STYLES = {
  classic: {
    label: "أخضر",
    theme: {
      bg: ["#0a3a2c", "#0f5541"],
      pattern: { kind: "lattice", color: "rgba(217, 179, 91, 0.07)" },
      text: "#f6f1e3",
      soft: "rgba(246, 241, 227, 0.75)",
      accent: "#d9b35b",
      panel: "rgba(255, 255, 255, 0.07)",
      panelStrong: "rgba(217, 179, 91, 0.16)",
      panelBorder: "rgba(217, 179, 91, 0.18)",
      vignette: true,
      layout: "rows",
    },
  },
  night: {
    label: "ليلي",
    theme: {
      bg: ["#070b1f", "#1b2757"],
      pattern: { kind: "stars" },
      text: "#f3eee0",
      soft: "rgba(243, 238, 224, 0.7)",
      accent: "#e6c67a",
      panel: "rgba(255, 255, 255, 0.06)",
      panelStrong: "rgba(230, 198, 122, 0.16)",
      panelBorder: "rgba(230, 198, 122, 0.22)",
      vignette: true,
      layout: "rows",
    },
  },
  white: {
    label: "أبيض",
    theme: {
      bg: ["#ffffff", "#f5f2ea"],
      pattern: { kind: "lattice", color: "rgba(15, 85, 65, 0.05)" },
      text: "#14352b",
      soft: "rgba(20, 53, 43, 0.65)",
      accent: "#0f5541",
      panel: "rgba(15, 85, 65, 0.05)",
      panelStrong: "rgba(184, 144, 58, 0.16)",
      panelBorder: "rgba(15, 85, 65, 0.14)",
      vignette: false,
      layout: "rows",
    },
  },
  sand: {
    label: "رملي",
    theme: {
      bg: ["#f4e5c3", "#e6cd9b"],
      pattern: { kind: "lattice", color: "rgba(122, 79, 36, 0.08)" },
      text: "#3a2915",
      soft: "rgba(58, 41, 21, 0.7)",
      accent: "#8a5a2b",
      panel: "rgba(255, 255, 255, 0.4)",
      panelStrong: "rgba(138, 90, 43, 0.14)",
      panelBorder: "rgba(138, 90, 43, 0.22)",
      vignette: false,
      layout: "rows",
    },
  },
  tiles: {
    label: "بطاقات",
    theme: {
      bg: ["#0f5541", "#0a3a2c"],
      pattern: { kind: "lattice", color: "rgba(217, 179, 91, 0.06)" },
      text: "#f6f1e3",
      soft: "rgba(246, 241, 227, 0.72)",
      accent: "#d9b35b",
      panel: "rgba(0, 0, 0, 0.18)",
      panelStrong: "rgba(217, 179, 91, 0.2)",
      panelBorder: "rgba(217, 179, 91, 0.3)",
      vignette: true,
      layout: "tiles",
    },
  },
} satisfies Record<string, { label: string; theme: PrayerCardTheme }>;

export type PrayerCardStyleId = keyof typeof PRAYER_CARD_STYLES;
export const DEFAULT_PRAYER_CARD_STYLE: PrayerCardStyleId = "classic";
export const PRAYER_CARD_STYLE_IDS = Object.keys(PRAYER_CARD_STYLES) as PrayerCardStyleId[];
export const isPrayerCardStyle = (v: unknown): v is PrayerCardStyleId => typeof v === "string" && Object.hasOwn(PRAYER_CARD_STYLES, v);
