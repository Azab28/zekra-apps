/**
 * The looks of his dua poster (/ali, src/lib/images/dua-poster.ts): five
 * colourings × four frames = twenty. Client-safe.
 */
export type PosterPalette = {
  label: string;
  /** Background, top to bottom. */
  bg: [string, string];
  text: string;
  /** His name and the closing line. */
  accent: string;
  gold: string;
  /** The ornaments' second colour. */
  deep: string;
};

export const POSTER_PALETTES: PosterPalette[] = [
  { label: "أبيض وذهبي", bg: ["#fffdf7", "#fbf5e6"], text: "#1d1a14", accent: "#1f7a34", gold: "#c9a24e", deep: "#1f6b3a" },
  { label: "رملي", bg: ["#f6ead0", "#ecd9b0"], text: "#3a2915", accent: "#7a4f24", gold: "#b8863b", deep: "#7a4f24" },
  { label: "زمرّدي", bg: ["#0f5541", "#0a3a2c"], text: "#fbf6e6", accent: "#f0cf7a", gold: "#d9b35b", deep: "#0b4636" },
  { label: "ليلي", bg: ["#0b1330", "#1c2a5a"], text: "#f3eee0", accent: "#e8c877", gold: "#d9b35b", deep: "#26357a" },
  { label: "أسود وذهبي", bg: ["#141414", "#1f1c17"], text: "#f2eee4", accent: "#d9b35b", gold: "#c9a24e", deep: "#2c2820" },
];

export const POSTER_FRAMES = ["زخارف الأركان", "محراب", "إطار منقوش", "شريط مزخرف"] as const;

export const POSTER_COUNT = POSTER_PALETTES.length * POSTER_FRAMES.length;

/** Style n (0–19): its colouring and its frame. */
export const posterStyle = (n: number) => ({ palette: POSTER_PALETTES[n % POSTER_PALETTES.length], frame: Math.floor(n / POSTER_PALETTES.length) % POSTER_FRAMES.length });

export const posterLabel = (n: number) => {
  const s = posterStyle(n);
  return `${s.palette.label} · ${POSTER_FRAMES[s.frame]}`;
};

export const isPosterStyle = (n: number) => Number.isInteger(n) && n >= 0 && n < POSTER_COUNT;
