/**
 * The Quran in the app, all from src/lib on data/quran.json and qcf.json
 * (bundled through src/shims): surahs, juz starts, the mushaf page of an ayah,
 * and the last page read on this device.
 */
import { quran } from "@lib/content/data";
import { SELECTED_AYAT } from "@lib/content/selected-ayat";
import { shortSurahName } from "@lib/content/arabic";
import { MUSHAF_PAGES, mushafPageOf } from "@lib/content/mushaf-pages";
import { readJson, writeJson } from "./storage";

export { MUSHAF_PAGES };

export type SurahEntry = { n: number; name: string; ayahCount: number; medinan: boolean; page: number; start: number };

let surahList: SurahEntry[] | null = null;

/** The 114 surahs with their short name and first mushaf page. */
export function surahs(): SurahEntry[] {
  return (surahList ??= quran().surahs.map((s) => ({
    n: s.n,
    name: shortSurahName(s.name),
    ayahCount: s.ayahCount,
    medinan: s.type === "Medinan",
    page: mushafPageOf(s.start),
    start: s.start,
  })));
}

export const surahName = (n: number) => surahs()[n - 1]?.name ?? "";

let juzList: { juz: number; page: number; index: number }[] | null = null;

/** Each juz's first ayah and page. */
export function juzStarts() {
  if (!juzList) {
    const seen = new Map<number, number>();
    quran().ayahs.forEach((a, i) => {
      if (!seen.has(a[3])) seen.set(a[3], i);
    });
    juzList = [...seen].map(([juz, index]) => ({ juz, index, page: mushafPageOf(index) }));
  }
  return juzList;
}

/** An ayah by its index into quran.json: surah, number and text. */
export function ayahAt(index: number) {
  const [surah, ayah, , juz, text] = quran().ayahs[index];
  return { index, surah, ayah, juz, text, surahName: surahName(surah) };
}

const LAST = "mushaf:last";
export const lastPage = async () => {
  const p = await readJson<number>(LAST);
  return typeof p === "number" && Number.isInteger(p) && p >= 1 && p <= MUSHAF_PAGES ? p : null;
};
export const saveLastPage = (page: number) => writeJson(LAST, page);

/** Today's passage, the same as the site's home page (src/lib/site.ts ayahOfTheDay: one of SELECTED_AYAT per UTC day). */
export function ayahOfTheDay(date = new Date()): number[] {
  const day = Math.floor(date.getTime() / 86_400_000);
  const [surah, from, to] = SELECTED_AYAT[(day * 7919) % SELECTED_AYAT.length];
  const start = quran().surahs[surah - 1].start;
  return Array.from({ length: to - from + 1 }, (_, i) => start + from - 1 + i);
}
