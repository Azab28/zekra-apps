/**
 * Listening: the wird's progress, the recent and resumable recordings, the
 * surahs suggested for the time, and when the Quran alarm and Friday's Al-Kahf
 * notice fall due. Shared by the background and the pages.
 */
import { ayahAudioUrl, basmalaAudioUrl } from "../../../../src/lib/ayah-audio";
import { ayahAt, AYAH_TOTAL, juzOf, juzRange, SURAHS } from "./quran";
import type { Track } from "./radio";
import type { Settings } from "./settings";
import { timesOn, placeDay } from "./times";

// ---------- the wird ----------

export const WIRD_KEY = "wird";
/** `pos`: the next ayah to hear; `doneDay`: the day a juz was last finished; `khatmas`: whole Qurans heard. */
export type Wird = { pos: number; doneDay: string | null; khatmas: number };

export async function loadWird(): Promise<Wird> {
  const w = (await chrome.storage.local.get(WIRD_KEY))[WIRD_KEY] as Partial<Wird> | undefined;
  const pos = Number(w?.pos);
  return { pos: Number.isInteger(pos) && pos >= 0 && pos < AYAH_TOTAL ? pos : 0, doneDay: w?.doneDay ?? null, khatmas: Number(w?.khatmas) || 0 };
}

export const saveWird = (w: Wird) => chrome.storage.local.set({ [WIRD_KEY]: w });

/** The computer's date, "2026-10-04". */
export const today = (now = Date.now()) => new Date(now).toLocaleDateString("en-CA");

/** Today's juz: how far into it, and whether a juz was finished today. */
export function wirdProgress(w: Wird, now = Date.now()) {
  const r = juzRange(w.pos);
  return { juz: juzOf(w.pos), part: (w.pos - r.start) / (r.end - r.start + 1), done: w.doneDay === today(now), whole: w.pos / AYAH_TOTAL };
}

/** The ayah recordings from `from` to `end`, the basmala before each surah's first ayah (not Al-Fatiha's or At-Tawbah's). */
export function wirdItems(reciter: string, from: number, end: number): { urls: string[]; ayahs: number[] } {
  const urls: string[] = [];
  const ayahs: number[] = [];
  for (let i = from; i <= end; i++) {
    const { s, a } = ayahAt(i);
    if (a === 1 && s !== 1 && s !== 9) {
      urls.push(basmalaAudioUrl(reciter));
      ayahs.push(i);
    }
    urls.push(ayahAudioUrl(reciter, s, a));
    ayahs.push(i);
  }
  return { urls, ayahs };
}

// ---------- recent and resumable recordings ----------

export const RECENT_KEY = "radio.recent";
export const RESUME_KEY = "radio.resume";
/** Seconds into each surah of each recitation ("moshaf:surah"). */
export type Resume = Record<string, number>;
export const resumeKey = (moshaf: number, surah: number) => `${moshaf}:${surah}`;

export async function loadRecent(): Promise<Track[]> {
  const got = (await chrome.storage.local.get(RECENT_KEY))[RECENT_KEY];
  return Array.isArray(got) ? (got as Track[]) : [];
}

export async function loadResume(): Promise<Resume> {
  return ((await chrome.storage.local.get(RESUME_KEY))[RESUME_KEY] as Resume | undefined) ?? {};
}

/** «١٢:٠٥» or «١:٠٢:٠٥». */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  const out = hh ? `${hh}:${String(mm).padStart(2, "0")}:${ss}` : `${mm}:${ss}`;
  return out.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

// ---------- suggestions ----------

export const BAQARAH_KEY = "listen.baqarah";
/** Al-Baqarah is suggested again this long after it was last played. */
const BAQARAH_DAYS = 3;

export type Suggestion = { surah: number; why: string };

/**
 * Surahs for the time: Al-Kahf from Thursday's maghrib to Friday's (the whole
 * Friday without a place), Al-Mulk from isha to fajr (9 pm–4 am without a
 * place), Al-Baqarah when it wasn't played for a few days.
 */
export function suggestions(s: Settings, baqarahAt: number | null, now = Date.now()): Suggestion[] {
  const out: Suggestion[] = [];
  const d = new Date(now);
  const place = s.place;
  if (place) {
    const day = placeDay(place, 0, now);
    const t = timesOn(place, day);
    const wd = day.weekday; // 1 = Monday … 7 = Sunday
    if ((wd === 4 && now >= t.maghrib.getTime()) || (wd === 5 && now < t.maghrib.getTime())) out.push({ surah: 18, why: "يوم الجمعة" });
    if (now >= t.isha.getTime() || now < t.fajr.getTime()) out.push({ surah: 67, why: "قبل النوم" });
  } else {
    if (d.getDay() === 5) out.push({ surah: 18, why: "يوم الجمعة" });
    if (d.getHours() >= 21 || d.getHours() < 4) out.push({ surah: 67, why: "قبل النوم" });
  }
  if (!baqarahAt || now - baqarahAt > BAQARAH_DAYS * 86_400_000) out.push({ surah: 2, why: baqarahAt ? `لم تستمع إليها منذ ${daysAgo(now - baqarahAt)}` : "كل بضعة أيام" });
  return out;
}

function daysAgo(ms: number) {
  const n = Math.floor(ms / 86_400_000);
  return n <= 10 ? `${n.toLocaleString("ar-EG")} أيام` : `${n.toLocaleString("ar-EG")} يومًا`;
}

export const surahTitle = (n: number) => `سورة ${SURAHS[n - 1]?.[0] ?? ""}`;

// ---------- when the alarm and Friday's notice fall ----------

/** The next time the Quran alarm rings after `now`, or null (off, or fajr without a place). */
export function nextAlarm(s: Settings, now = Date.now()): number | null {
  const a = s.listen.alarm;
  if (!a.on) return null;
  if (a.mode === "fajr") {
    if (!s.place) return null;
    for (const d of [0, 1, 2]) {
      const at = timesOn(s.place, placeDay(s.place, d, now)).fajr.getTime() - a.before * 60_000;
      if (at > now) return at;
    }
    return null;
  }
  const [hh, mm] = a.time.split(":").map(Number);
  const at = new Date(now);
  at.setHours(hh, mm, 0, 0);
  if (at.getTime() <= now) at.setDate(at.getDate() + 1);
  return at.getTime();
}

/** Friday's Al-Kahf notice: the next Friday at 10:00 on the computer's clock. */
export function nextKahf(now = Date.now()): number {
  const at = new Date(now);
  at.setHours(10, 0, 0, 0);
  at.setDate(at.getDate() + ((5 - at.getDay() + 7) % 7));
  if (at.getTime() <= now) at.setDate(at.getDate() + 7);
  return at.getTime();
}
