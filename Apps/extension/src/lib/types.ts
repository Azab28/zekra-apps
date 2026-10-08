/** What scripts/build-extension.ts embeds from data/*.json and extension/backgrounds.json. */

/** A curated short passage (src/lib/content/selected-ayat.ts). */
export type ExtAyah = {
  s: number;
  from: number;
  to: number;
  /** Tanzil Uthmani text with ۝ ayah numbers. */
  text: string;
  /** Per ayah, its printed lines in the Madinah mushaf: [page, line, QCF V2 glyph codes]. */
  ayahLines: [number, number, string][][];
};

/** One Hisn al-Muslim item. */
export type ExtZikr = { text: string; chapter: string };

export type ExtStation = { id: number; name: string; url: string; group: "reciter" | "program" };

/** A background photo from Wikimedia Commons, shown with its author and license. */
export type ExtBackground = {
  id: string;
  category: "islamic" | "nature";
  url: string;
  thumb: string;
  /** Its average colour, for the glass tint and the first paint. */
  color: string;
  title: string;
  author: string;
  license: string;
  source: string;
};

/** An mp3quran.net reciter: [id, name, [moshaf id, riwaya, server folder, surahs (0: all 114)][]]. */
export type ExtReciterRow = readonly [number, string, readonly (readonly [number, string, string, number[] | 0])[]];
