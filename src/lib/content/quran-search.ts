/**
 * Word search over the Quran text (data/quran.json, Uthmani script). Both the
 * query and the ayat are reduced to a bare letter skeleton so ordinary typing
 * finds the Uthmani spelling: no diacritics or Quranic marks, one form of
 * alef/hamza/yaa/taa marbuta, and no alef at all (Uthmani writes many long
 * alefs as a small mark, e.g. «ٱلْكِتَٰبُ» for «الكتاب», «ٱلصَّلَوٰةَ» for «الصلاة»).
 */
import { quran } from "./data";

/** The letter skeleton used for matching. */
export function normalizeArabic(text: string): string {
  return (
    text
      // A waw or alef maqsura carrying a small alef reads as a long alef («الصلوٰة», «على»).
      .replace(/[وى]ٰ/g, (m) => (m[0] === "و" ? "ا" : "ى"))
      .replace(/ٰ/g, "ا")
      // Harakat, Quranic annotation marks, small letters, tatweel.
      .replace(/[ؐ-ًؚ-ٟۖ-ۭـ]/g, "")
      .replace(/[ٱأإآ]/g, "ا")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/ء/g, "")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/ا/g, "")
      .replace(/[^ء-ي\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

let index: string[] | null = null;

/** Normalized text of every ayah, by index into data/quran.json. */
function searchIndex(): string[] {
  return (index ??= quran().ayahs.map((a) => ` ${normalizeArabic(a[4])} `));
}

/** Indices of the ayat containing the query (in mushaf order), or null if the query is too short. */
export function searchQuran(query: string): number[] | null {
  const q = normalizeArabic(query);
  if (q.replace(/\s/g, "").length < 2) return null;
  const out: number[] = [];
  searchIndex().forEach((text, i) => {
    if (text.includes(q)) out.push(i);
  });
  return out;
}
