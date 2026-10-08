/**
 * The whole Quran for the new tab's ayah card: surah facts and juz starts are
 * embedded, the rest (QCF glyph lines, Tanzil text, التفسير الميسر) are files
 * in data/ read on demand. Ayat are numbered 0..6235 in mushaf order.
 */
import type { ExtAyah } from "./types";

/** [short name, ayah count, Medinan, index of the first ayah]. */
export type SurahMeta = [name: string, ayahCount: number, medinan: boolean, start: number];
export const SURAHS: SurahMeta[] = __SURAHS__;
/** Index of each juz's first ayah. */
export const JUZ_STARTS: number[] = __JUZ__;
export const AYAH_TOTAL = 6236;

export type QcfLine = [page: number, line: number, codes: string];
/** A run of ayat by index, both ends included. */
export type Range = { start: number; end: number };

export const indexOf = (s: number, a: number) => SURAHS[s - 1][3] + a - 1;
export const wrap = (i: number) => ((i % AYAH_TOTAL) + AYAH_TOTAL) % AYAH_TOTAL;

export function ayahAt(index: number): { s: number; a: number } {
  const i = wrap(index);
  let s = 1;
  while (s < 114 && SURAHS[s][3] <= i) s++;
  return { s, a: i - SURAHS[s - 1][3] + 1 };
}

export const juzOf = (i: number) => JUZ_STARTS.filter((st) => st <= i).length;

export function surahRange(i: number): Range {
  const { s } = ayahAt(i);
  const [, count, , start] = SURAHS[s - 1];
  return { start, end: start + count - 1 };
}

export function juzRange(i: number): Range {
  const j = juzOf(i);
  return { start: JUZ_STARTS[j - 1], end: (JUZ_STARTS[j] ?? AYAH_TOTAL) - 1 };
}

/** «البقرة ٣٦–٤٠», «البقرة ٢٨٦ – آل عمران ٥». */
export function rangeLabel(r: Range, n: (x: number) => string): string {
  const a = ayahAt(r.start);
  const b = ayahAt(r.end);
  const name = (s: number) => SURAHS[s - 1][0];
  if (a.s !== b.s) return `${name(a.s)} ${n(a.a)} – ${name(b.s)} ${n(b.a)}`;
  return `${name(a.s)} ${a.a === b.a ? n(a.a) : `${n(a.a)}–${n(b.a)}`}`;
}

const file = <T>(name: string) => {
  let p: Promise<T> | undefined;
  return () => {
    p ??= fetch(chrome.runtime.getURL(`data/${name}`)).then((r) => r.json() as Promise<T>);
    p.catch(() => (p = undefined));
    return p;
  };
};

/** "s:a" → printed lines. */
export const loadQcf = file<Record<string, QcfLine[]>>("qcf.json");
/** By ayah index: the Tanzil Uthmani text. */
export const loadText = file<string[]>("text.json");
/** By ayah index: التفسير الميسر. */
export const loadTafsir = file<string[]>("tafsir.json");

const key = (i: number) => {
  const { s, a } = ayahAt(i);
  return `${s}:${a}`;
};

/** The mushaf page an ayah begins on. */
export async function pageOf(i: number): Promise<number> {
  return (await loadQcf())[key(i)]?.[0]?.[0] ?? 1;
}

/** Every ayah that begins on that ayah's page. */
export async function pageRange(i: number): Promise<Range> {
  const qcf = await loadQcf();
  const page = qcf[key(i)]?.[0]?.[0];
  let start = i;
  let end = i;
  while (start > 0 && qcf[key(start - 1)]?.[0]?.[0] === page) start--;
  while (end < AYAH_TOTAL - 1 && qcf[key(end + 1)]?.[0]?.[0] === page) end++;
  return { start, end };
}

export type AyahView = { i: number; s: number; a: number; lines: QcfLine[]; text: string };

export const curatedRange = (c: ExtAyah): Range => ({ start: indexOf(c.s, c.from), end: indexOf(c.s, c.to) });

/** The ayat of a range with their lines and text; a curated passage comes from the bundle without reading a file. */
export async function ayatOf(r: Range, curated?: ExtAyah): Promise<AyahView[]> {
  if (curated) {
    const cr = curatedRange(curated);
    if (cr.start === r.start && cr.end === r.end) {
      const texts = curated.text.split(/\s*۝[٠-٩]+\s*/).filter(Boolean);
      return curated.ayahLines.map((lines, k) => ({ i: r.start + k, s: curated.s, a: curated.from + k, lines, text: texts[k] ?? "" }));
    }
  }
  const [qcf, text] = await Promise.all([loadQcf(), loadText()]);
  const out: AyahView[] = [];
  for (let i = r.start; i <= r.end; i++) {
    const { s, a } = ayahAt(i);
    out.push({ i, s, a, lines: qcf[`${s}:${a}`] ?? [], text: text[i] ?? "" });
  }
  return out;
}
