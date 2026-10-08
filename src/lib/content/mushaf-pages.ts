/**
 * The Madinah mushaf's pages from data/qcf.json (QCF V2 glyph codes per
 * printed line): which ayat each page holds, and a page's printed lines for
 * the website, where the browser draws them with the page's own font.
 */
import { qcf, quran } from "./data";

export const MUSHAF_PAGES = 604;

let pageIndex: Map<number, number[]> | null = null;

/** Ayah indices (into data/quran.json) printed on this mushaf page, in order. */
export function mushafPageAyat(page: number): number[] {
  if (!pageIndex) {
    pageIndex = new Map();
    const q = quran();
    for (const [key, lines] of Object.entries(qcf().verses)) {
      const [surah, ayah] = key.split(":").map(Number);
      const index = q.surahs[surah - 1].start + ayah - 1;
      for (const p of new Set(lines.map((l) => l[0]))) pageIndex.set(p, [...(pageIndex.get(p) ?? []), index]);
    }
    for (const list of pageIndex.values()) list.sort((a, b) => a - b);
  }
  return pageIndex.get(page) ?? [];
}

/** First mushaf page of an ayah (index into data/quran.json). */
export function mushafPageOf(index: number): number {
  const [surah, ayah] = quran().ayahs[index];
  return qcf().verses[`${surah}:${ayah}`][0][0];
}

/** One piece of a printed line: the words of one ayah on it. */
export type PageSegment = { index: number; codes: string };
export type PageRow =
  | { kind: "header"; surah: number }
  | { kind: "basmala" }
  | { kind: "line"; line: number; segments: PageSegment[] };

/**
 * A page as printed: its lines (each split by ayah, so an ayah can be tapped)
 * with the surah headers and basmala where a surah starts on it.
 */
export function mushafPageRows(page: number): PageRow[] {
  const q = quran();
  const rows: PageRow[] = [];
  const byLine = new Map<number, Extract<PageRow, { kind: "line" }>>();
  for (const index of mushafPageAyat(page)) {
    const [surah, ayah] = q.ayahs[index];
    const lines = qcf().verses[`${surah}:${ayah}`];
    if (ayah === 1 && lines[0][0] === page) {
      rows.push({ kind: "header", surah });
      // Al-Fatiha's basmala is its first ayah; At-Tawbah has none.
      if (surah !== 1 && surah !== 9) rows.push({ kind: "basmala" });
    }
    for (const [linePage, line, codes] of lines) {
      if (linePage !== page) continue;
      const existing = byLine.get(line);
      if (existing) {
        existing.segments.push({ index, codes });
        continue;
      }
      const row = { kind: "line" as const, line, segments: [{ index, codes }] };
      byLine.set(line, row);
      rows.push(row);
    }
  }
  return rows;
}

/** The basmala as printed on page 1 (Al-Fatiha's first ayah without its end mark), drawn in the page-1 font. */
export function basmalaCodes(): string {
  return [...qcf().verses["1:1"][0][2]].slice(0, -1).join("");
}

/** Surahs and juz a page belongs to, for its header. */
export function pageInfo(page: number): { surahs: number[]; juz: number } {
  const ayat = mushafPageAyat(page);
  const q = quran();
  return { surahs: [...new Set(ayat.map((i) => q.ayahs[i][0]))], juz: q.ayahs[ayat[0]][3] };
}
