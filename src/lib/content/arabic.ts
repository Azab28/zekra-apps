const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function toArabicDigits(n: number | string): string {
  return String(n).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);
}

/** Removes tashkeel (harakat, shadda, sukun, maddah, superscript alef, Quranic marks). */
export function stripTashkeel(s: string): string {
  return s.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
}

/**
 * Loose form for matching text: no tashkeel or tatweel, hamza seats and
 * alef variants unified, ى→ي and ة→ه. Used to check references against text.
 */
export function normalizeForSearch(s: string): string {
  return stripTashkeel(s)
    .replace(/\u0640/g, "")
    .replace(/[\u0671\u0622\u0623\u0625]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0624/g, "\u0648")
    .replace(/\u0626/g, "\u064A")
    .replace(/\u0621/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "سُورَةُ البَقَرَةِ" → "البقرة" */
export function shortSurahName(fullName: string): string {
  // Alef + combining maddah is «آ» (آل عمران): keep it before the marks go.
  return stripTashkeel(fullName.replace(/\u0627\u0653/g, "\u0622"))
    .replace(/\u0640/g, "") // tatweel (المائـدة)
    .replace(/\u0671/g, "\u0627") // alef wasla → alef
    .replace(/^سورة\s+/, "")
    .trim();
}

/** Arabic count phrase for how many times a zikr is repeated; empty for 1. */
export function repeatLabel(n: number): string {
  if (n <= 1) return "";
  if (n === 2) return "مرتان";
  if (n <= 10) return `${toArabicDigits(n)} مرات`;
  return `${toArabicDigits(n)} مرة`;
}
