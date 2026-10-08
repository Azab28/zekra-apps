/** Today's progress in an azkar set on this device (as the site's reader keeps it in localStorage). */
import { readJson, writeJson } from "./storage";

export type ReaderProgress = { day: string; index: number; counts: number[] };

export const today = () => new Date().toDateString();
const key = (slug: string) => `reader:${slug}`;

/** Today's saved progress for a set of `total` azkar, or null (another day, or the set changed). */
export async function loadProgress(slug: string, total: number): Promise<ReaderProgress | null> {
  const s = await readJson<ReaderProgress>(key(slug));
  if (!s || s.day !== today() || !Array.isArray(s.counts) || s.counts.length !== total) return null;
  return s;
}

export const saveProgress = (slug: string, p: Omit<ReaderProgress, "day">) => writeJson(key(slug), { ...p, day: today() });

/** 0..1: how many of the set's azkar were started today. */
export async function progressShare(slug: string, total: number): Promise<number> {
  const s = await loadProgress(slug, total);
  return s ? s.counts.filter((c) => c > 0).length / total : 0;
}
