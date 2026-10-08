/** Recorded recitations from mp3quran.net (data/reciters.json, embedded by the build): one MP3 per surah. */

export type ExtMoshaf = { id: number; name: string; server: string; surahs: number[] };
export type ExtReciter = { id: number; name: string; moshaf: ExtMoshaf[] };

const ALL = Array.from({ length: 114 }, (_, i) => i + 1);

export const RECITERS: ExtReciter[] = __RECITERS__.map(([id, name, ms]) => ({
  id,
  name,
  moshaf: ms.map(([mid, mname, server, surahs]) => ({ id: mid, name: mname, server, surahs: surahs === 0 ? ALL : surahs })),
}));

/** Mishary Alafasy, Hafs (the recordings the suggestions and the alarm use until another is picked). */
export const DEFAULT_MOSHAF = 123;

export function moshafById(id: number): { reciter: ExtReciter; moshaf: ExtMoshaf } | null {
  for (const reciter of RECITERS) {
    const moshaf = reciter.moshaf.find((m) => m.id === id);
    if (moshaf) return { reciter, moshaf };
  }
  return null;
}

export const reciterById = (id: number) => RECITERS.find((r) => r.id === id) ?? null;

export const surahUrl = (m: ExtMoshaf, surah: number) => `${m.server}${String(surah).padStart(3, "0")}.mp3`;

/** «مشاري العفاسي» or, when the reciter has several, «… — ورش عن نافع». */
export function moshafLabel(id: number): string {
  const got = moshafById(id) ?? moshafById(DEFAULT_MOSHAF);
  if (!got) return "";
  return got.reciter.moshaf.length > 1 ? `${got.reciter.name} — ${got.moshaf.name}` : got.reciter.name;
}
