/**
 * Listening helpers shared by the alarm, the suggestions and the recitations
 * (as the extension's lib/listen.ts): a surah from the chosen recitation, a
 * live station, the surahs suggested for the time, and the recently played.
 */
import { DateTime } from "luxon";
import { AYAH_TOTAL } from "@lib/ayah-audio";
import { radioStations, reciters } from "@lib/content/data";
import { prayerTimesFor, type Place } from "@lib/schedule/prayer-calc";
import type { RadioTrack, SurahTrack, Track } from "./player";
import { dayAt } from "./prayer";
import { juzStarts } from "./quran";
import type { Listen } from "./settings";
import { readJson, writeJson } from "./storage";

/** The chosen recitation (else the first that has the surah) as a track for `surah`. */
export function surahTrack(listen: Pick<Listen, "reciterId" | "moshafId">, surah: number): SurahTrack | null {
  const all = reciters();
  const r = all.find((x) => x.id === listen.reciterId);
  const m = r?.moshaf.find((x) => x.id === listen.moshafId && x.surahs.includes(surah)) ?? r?.moshaf.find((x) => x.surahs.includes(surah));
  if (!r || !m) return null;
  return { kind: "surah", reciter: r.name, reciterId: r.id, moshaf: m.name, moshafId: m.id, server: m.server, surahs: m.surahs, surah };
}

export function stationTrack(id: number): RadioTrack | null {
  const s = radioStations().find((x) => x.id === id) ?? radioStations()[0];
  return s ? { kind: "radio", id: s.id, name: s.name, url: s.url } : null;
}

// ---------- suggestions ----------

export type Suggestion = { surah: number; why: string };
const BAQARAH_KEY = "listen:baqarah";
const BAQARAH_DAYS = 3;

/** When Al-Baqarah was last played (for «كل بضعة أيام»). */
export const baqarahAt = () => readJson<number>(BAQARAH_KEY);

/**
 * Surahs for the time (the extension's suggestions): Al-Kahf from Thursday's
 * maghrib to Friday's, Al-Mulk from isha to fajr, Al-Baqarah when it wasn't
 * played for a few days. Without a place, by the phone's clock.
 */
export function suggestions(place: Place | null, lastBaqarah: number | null, now = Date.now()): Suggestion[] {
  const out: Suggestion[] = [];
  if (place) {
    const day = dayAt(place.timezone, now);
    const t = prayerTimesFor(day, place);
    const wd = day.weekday;
    if ((wd === 4 && now >= t.maghrib.getTime()) || (wd === 5 && now < t.maghrib.getTime())) out.push({ surah: 18, why: "يوم الجمعة" });
    if (now >= t.isha.getTime() || now < t.fajr.getTime()) out.push({ surah: 67, why: "قبل النوم" });
  } else {
    const d = new Date(now);
    if (d.getDay() === 5) out.push({ surah: 18, why: "يوم الجمعة" });
    if (d.getHours() >= 21 || d.getHours() < 4) out.push({ surah: 67, why: "قبل النوم" });
  }
  if (!lastBaqarah || now - lastBaqarah > BAQARAH_DAYS * 86_400_000) out.push({ surah: 2, why: "كل بضعة أيام" });
  return out;
}

// ---------- recently played ----------

const RECENT_KEY = "listen:recent";
const RECENT_MAX = 12;
export type Recent = { key: string; track: SurahTrack | RadioTrack; at: number };

const recentKey = (t: SurahTrack | RadioTrack) => (t.kind === "radio" ? `radio:${t.id}` : `surah:${t.moshafId}:${t.surah}`);

export async function loadRecent(): Promise<Recent[]> {
  const r = await readJson<Recent[]>(RECENT_KEY);
  return Array.isArray(r) ? r.filter((x) => x && x.track && (x.track.kind === "surah" || x.track.kind === "radio")) : [];
}

/** Called by the player for what starts playing (a surah or a station; ayah by ayah isn't kept). */
export async function rememberPlayed(t: Track) {
  if (t.kind === "ayah") return;
  if (t.kind === "surah" && t.surah === 2) void writeJson(BAQARAH_KEY, Date.now());
  const key = recentKey(t);
  const list = (await loadRecent()).filter((x) => x.key !== key);
  await writeJson(RECENT_KEY, [{ key, track: t, at: Date.now() }, ...list].slice(0, RECENT_MAX));
}

// ---------- the listening wird ----------

/** `pos`: the next ayah to hear; `doneDay`: the day a juz was last finished; `khatmas`: whole Qurans heard (the extension's Wird). */
export type Wird = { pos: number; doneDay: string | null; khatmas: number };
const WIRD_KEY = "listen:wird";

export async function loadWird(): Promise<Wird> {
  const w = await readJson<Partial<Wird>>(WIRD_KEY);
  const pos = Number(w?.pos);
  return { pos: Number.isInteger(pos) && pos >= 0 && pos < AYAH_TOTAL ? pos : 0, doneDay: typeof w?.doneDay === "string" ? w.doneDay : null, khatmas: Number(w?.khatmas) || 0 };
}

/** The juz an ayah is in, and its first and last ayah (quran.json's juz column). */
export function juzRange(index: number): { juz: number; start: number; end: number } {
  const starts = juzStarts();
  let i = starts.length - 1;
  while (i > 0 && starts[i].index > index) i--;
  return { juz: starts[i].juz, start: starts[i].index, end: i + 1 < starts.length ? starts[i + 1].index - 1 : AYAH_TOTAL - 1 };
}

/** The phone's date, «2026-10-04». */
const today = () => DateTime.now().toISODate() ?? "";

/** Today's wird: the juz, how far into it, whether one was finished today, and the whole khatma's share. */
export function wirdProgress(w: Wird) {
  const r = juzRange(w.pos);
  return { juz: r.juz, part: (w.pos - r.start) / (r.end - r.start + 1), done: w.doneDay === today(), whole: w.pos / AYAH_TOTAL, end: r.end };
}

/** The player reached this ayah of the wird. */
export async function wirdAt(index: number) {
  const w = await loadWird();
  await writeJson(WIRD_KEY, { ...w, pos: index });
}

/** The wird's juz was heard to its last ayah: on to the next juz (a whole Quran wraps around). */
export async function wirdDone(lastIndex: number) {
  const w = await loadWird();
  const next = lastIndex + 1;
  await writeJson(WIRD_KEY, next >= AYAH_TOTAL ? { pos: 0, doneDay: today(), khatmas: w.khatmas + 1 } : { ...w, pos: next, doneDay: today() });
}
