/**
 * The site is a «صدقة جارية» for the owner's father, علي متولي عزب: his page
 * (/ali), and the few quiet lines that point to it (the footer, /about, the
 * bot's /start, a finished khatma or azkar, the mushaf and booklet PDFs).
 * Client-safe.
 */
import { posterText, type PosterText } from "./dua-poster-text";

export const MEMORIAL = {
  name: "علي متولي عزب",
  path: "/ali",
  /** The day he passed away (Gregorian). */
  died: "2026-09-19",
  /** His permanent «صدقة جارية» khatma (/k/<slug>, shown on his page). */
  khatmaSlug: "aliazab",
  /** The media collection (/dashboard/admin/media) whose photos his page shows. */
  photos: "علي متولي عزب",
} as const;

/** «ذِكرى صدقة جارية عن علي متولي عزب رحمه الله» */
export const MEMORIAL_LINE = `صدقة جارية عن ${MEMORIAL.name} رحمه الله`;

/** Under his name on his page. */
export const MEMORIAL_MOTTO = "ستظل ذكراه في قلوبنا";

/** His poster: the family's duas (src/lib/dua-poster-text.ts), their own closing line. */
export const MEMORIAL_POSTER: PosterText = { ...posterText(false), footer: "ربنا يرحمك يا طيب" };

/** After a finished khatma or azkar: a line asking for a prayer for him. */
export const MEMORIAL_ASK = `لا تنسَ في دعائك ${MEMORIAL.name}؛ هذا الموقع صدقة جارية عنه، رحمه الله.`;
