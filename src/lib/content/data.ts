import { readFileSync } from "node:fs";
import path from "node:path";

export type Surah = {
  n: number;
  name: string;
  englishName: string;
  type: string;
  ayahCount: number;
  /** Index into `ayahs` of this surah's first ayah. */
  start: number;
};

/** [surah, ayahInSurah, page, juz, text, ruku] */
export type AyahRow = [number, number, number, number, string, number];

export type QuranData = { source: string; basmala: string; surahs: Surah[]; ayahs: AyahRow[] };

export type ZikrItem = { id: number; text: string; repeat: number; audio: string };
export type HisnChapter = { id: number; title: string; audio: string; items: ZikrItem[] };
export type HisnData = { source: string; chapters: HisnChapter[] };

export type RadioStation = { id: number; name: string; url: string; group: "reciter" | "program" };

/** One printed line of an ayah in the Madinah mushaf: [page, line, QCF V2 glyph codes]. */
export type QcfLine = [number, number, string];
export type QcfData = { source: string; verses: Record<string, QcfLine[]> };

/** A recitation (riwaya/style) of a reciter on mp3quran.net; surah audio is `${server}${NNN}.mp3`. */
export type Moshaf = { id: number; name: string; server: string; surahs: number[] };
export type Reciter = { id: number; name: string; moshaf: Moshaf[] };

const cache: {
  quran?: QuranData;
  hisn?: HisnData;
  pages?: number[];
  passages?: number[];
  mediumPassages?: number[];
  radios?: RadioStation[];
  qcf?: QcfData;
  reciters?: Reciter[];
  tafsir?: string[];
} = {};

function load<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(process.cwd(), "data", file), "utf8")) as T;
}

export function quran(): QuranData {
  return (cache.quran ??= load<QuranData>("quran.json"));
}

export function hisn(): HisnData {
  return (cache.hisn ??= load<HisnData>("hisn.json"));
}

/** Live Quran radio stations from mp3quran.net (data/radios.json). */
export function radioStations(): RadioStation[] {
  return (cache.radios ??= load<{ stations: RadioStation[] }>("radios.json").stations);
}

/** Mushaf glyph codes per ayah ("2:255"), from data/qcf.json (bun run content:qcf). */
export function qcf(): QcfData {
  return (cache.qcf ??= load<QcfData>("qcf.json"));
}

/** Reciters with their recitations, from data/reciters.json (bun run content:extra). */
export function reciters(): Reciter[] {
  return (cache.reciters ??= load<{ reciters: Reciter[] }>("reciters.json").reciters);
}

/** التفسير الميسر, one entry per ayah index (data/tafsir-muyassar.json, bun run content:extra). */
export function tafsirMuyassar(): string[] {
  return (cache.tafsir ??= load<{ ayahs: string[] }>("tafsir-muyassar.json").ayahs);
}

export const PAGE_COUNT = 604;
export const AYAH_COUNT = 6236;
/** Thematic passages (rukus). Every short surah is a single passage. */
export const PASSAGE_COUNT = 556;

/** pageStarts[p - 1] = index of the first ayah on Mushaf page p. */
export function pageStarts(): number[] {
  if (!cache.pages) {
    const starts: number[] = [];
    quran().ayahs.forEach((a, i) => {
      if (starts[a[2] - 1] === undefined) starts[a[2] - 1] = i;
    });
    cache.pages = starts;
  }
  return cache.pages;
}

/** passageStarts()[p - 1] = index of the first ayah of passage (ruku) p. */
export function passageStarts(): number[] {
  if (!cache.passages) {
    const starts: number[] = [];
    quran().ayahs.forEach((a, i) => {
      if (starts[a[5] - 1] === undefined) starts[a[5] - 1] = i;
    });
    cache.passages = starts;
  }
  return cache.passages;
}

/** Longest passage (in characters) that "smart" mode may post. */
export const MEDIUM_PASSAGE_MAX_CHARS = 1000;

/** 0-based numbers of passages no longer than MEDIUM_PASSAGE_MAX_CHARS. */
export function mediumPassages(): number[] {
  if (!cache.mediumPassages) {
    const lengths: number[] = [];
    for (const a of quran().ayahs) lengths[a[5] - 1] = (lengths[a[5] - 1] ?? 0) + a[4].length;
    cache.mediumPassages = lengths.flatMap((len, p) => (len <= MEDIUM_PASSAGE_MAX_CHARS ? [p] : []));
  }
  return cache.mediumPassages;
}

export function chapterById(id: number): HisnChapter | undefined {
  return hisn().chapters.find((c) => c.id === id);
}

/** Chapter ids used by the default schedules. */
export const CHAPTERS = {
  morningEvening: 27,
  sleep: 28,
  afterPrayer: 25,
  istighfar: 129,
  tasbeeh: 130,
  salawat: 107,
} as const;
