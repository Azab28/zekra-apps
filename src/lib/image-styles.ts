/**
 * Looks for the ayah and mushaf page images (src/lib/images/mushaf.ts):
 * «كلاسيكي» is the one the bot and channels always use; the website's
 * «صورة / خلفية» buttons draw the one the visitor picked in /settings
 * (reading prefs `imageStyle`, kept with the account). The same looks colour
 * the site's mushaf pages (reading pref `pageStyle`). Client-safe.
 */
export type MushafTheme = {
  /** The page. */
  paper: string;
  /** The Quran text. */
  ink: string;
  /** The outer band of the frame. */
  band: string;
  /** Rules, corner ornaments and the surah header's border. */
  gold: string;
  /** Surah names and the reference line. */
  heading: string;
  /** The footer (site or channel name). */
  muted: string;
  /** Inside the surah header. */
  headerFill: string;
};

export const IMAGE_STYLES = {
  classic: {
    label: "كلاسيكي",
    theme: { paper: "#fbf6e8", ink: "#1d1a14", band: "#0f5541", gold: "#c9a24e", heading: "#0f5541", muted: "#8a7d62", headerFill: "rgba(15, 85, 65, 0.07)" },
  },
  night: {
    label: "ليلي",
    theme: { paper: "#101a17", ink: "#efe6cf", band: "#0f5541", gold: "#c9a24e", heading: "#d9b35b", muted: "#a39676", headerFill: "rgba(217, 179, 91, 0.08)" },
  },
  emerald: {
    label: "زمرّدي",
    theme: { paper: "#0f5541", ink: "#f6f1e3", band: "#0a3a2c", gold: "#d9b35b", heading: "#f6f1e3", muted: "#cfe0d5", headerFill: "rgba(0, 0, 0, 0.14)" },
  },
  white: {
    label: "أبيض",
    theme: { paper: "#ffffff", ink: "#151515", band: "#e6e1d6", gold: "#b8903a", heading: "#151515", muted: "#8a8a8a", headerFill: "rgba(0, 0, 0, 0.03)" },
  },
  sand: {
    label: "رملي",
    theme: { paper: "#f1e0bd", ink: "#3a2915", band: "#7a4f24", gold: "#b8863b", heading: "#7a4f24", muted: "#86674a", headerFill: "rgba(122, 79, 36, 0.08)" },
  },
} satisfies Record<string, { label: string; theme: MushafTheme }>;

export type ImageStyleId = keyof typeof IMAGE_STYLES;
export const DEFAULT_IMAGE_STYLE: ImageStyleId = "classic";
export const IMAGE_STYLE_IDS = Object.keys(IMAGE_STYLES) as ImageStyleId[];
/** Styles on a dark page (the tajweed font switches to its light-letter palette). */
export const DARK_STYLES: readonly ImageStyleId[] = ["night", "emerald"];

/** Ayah images: where the words sit on the printed page, or from the start of the line (src/lib/images/mushaf.ts). */
/**
 * The frame around a surah's name where a surah starts in an ayah image
 * (src/lib/images/mushaf.ts): «none» leaves the name out (a whole page keeps it).
 */
export const SURAH_FRAMES = {
  classic: "إطار مزدوج",
  ornate: "مزخرف",
  cartouche: "شريط مدبّب",
  lines: "خطوط بلا إطار",
  none: "بدون اسم السورة",
} as const;
export type SurahFrameId = keyof typeof SURAH_FRAMES;
export const SURAH_FRAME_IDS = Object.keys(SURAH_FRAMES) as SurahFrameId[];
export const isSurahFrame = (v: unknown): v is SurahFrameId => typeof v === "string" && Object.hasOwn(SURAH_FRAMES, v);

export type AyahLayout = "mushaf" | "flow";
export const isAyahLayout = (v: unknown): v is AyahLayout => v === "mushaf" || v === "flow";

export const isImageStyle = (v: unknown): v is ImageStyleId => typeof v === "string" && Object.hasOwn(IMAGE_STYLES, v);
