/** Loose Arabic matching for names: no diacritics or tatweel, alef/hamza/yaa/taa forms unified. Client-safe. */
export const foldArabic = (s: string) =>
  s
    .replace(/[ً-ٰٟۖ-ۭـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
