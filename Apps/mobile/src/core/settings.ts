/** The app's own settings on this device (look, Asr madhab, adhan and azkar notifications, reading). */
import { AYAH_RECITERS, DEFAULT_AYAH_RECITER } from "@lib/ayah-audio";
import { DEFAULT_IMAGE_STYLE, isImageStyle, type ImageStyleId } from "@lib/image-styles";
import { DEFAULT_PALETTE, isPalette, type PaletteId } from "@lib/palettes";
import type { PrayerName } from "@lib/types";
import { ADHAN_VOICES, isAdhanVoice } from "./adhan-voices";

export type ThemeMode = "system" | "light" | "dark";
/** The floating bar's looks, as on the site (src/components/site/site-nav.tsx). */
export type NavStyle = "solid" | "glass" | "minimal";
export type Madhab = "shafi" | "hanafi";

/** The five prayers (sunrise has its own switch, off by default). */
export type Salah = Exclude<PrayerName, "sunrise">;
export const SALAH: Salah[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

/** Minutes before the adhan a reminder may come (0 = none). */
export const BEFORE_OPTIONS = [0, 5, 10, 15, 20, 30] as const;

export type AdhanSettings = {
  /** Notifications on at all (asked for permission when turned on). */
  enabled: boolean;
  prayers: Record<Salah, boolean>;
  sunrise: boolean;
  /** A reminder this many minutes before each chosen prayer (0 = none). */
  before: number;
  /** The adhan's sound: a muezzin (src/core/adhan-voices.ts) or the phone's notification sound. */
  voice: string;
  /** Morning azkar 20 min after fajr, evening azkar 20 min after asr (as the site's and the bot's). */
  morning: boolean;
  evening: boolean;
};

/** The occasions the app can remind of (src/lib/occasions-meta.ts; the imsakiya is a channel image, not a reminder). */
export const REMINDER_OCCASIONS = ["fasting", "fasting_weekly", "iftar", "suhoor", "dhul_hijjah", "arafah", "qadr_nights", "hijri_month", "eid", "qiyam", "duha"] as const;
export type ReminderOccasion = (typeof REMINDER_OCCASIONS)[number];
/** As a new channel's occasions: all but the daily qiyam and duha. */
const DEFAULT_REMINDER_OCCASIONS: ReminderOccasion[] = REMINDER_OCCASIONS.filter((k) => k !== "qiyam" && k !== "duha");

/** A zikr every so many minutes (the extension's choices). */
export const ZIKR_EVERY = [30, 60, 120, 180] as const;
/** Minutes before fajr the Quran alarm may ring (the extension's). */
export const ALARM_BEFORE = [0, 10, 15, 20, 30, 45, 60, 90] as const;

export type Reminders = {
  /** A zikr from Hisn al-Muslim every `every` minutes. */
  zikr: { on: boolean; every: number };
  /** Friday 10:00: a notice to read or hear Al-Kahf. */
  kahf: boolean;
  /** The Quran alarm: before fajr or at a time; a tap plays a surah or a station. */
  alarm: { on: boolean; mode: "fajr" | "time"; before: number; time: string; play: "surah" | "live"; surah: number; station: number };
  /** The occasions (fasting days, Ramadan, Dhul Hijjah, Eid…), as the bot's alerts. */
  occasions: { on: boolean; kinds: ReminderOccasion[] };
};

/** Listening (as the extension's `listen`): the recitation the suggestions and the alarm play, favourites. */
export type Listen = {
  /** mp3quran.net reciter and recitation (data/reciters.json); Mishary Alafasy, Hafs, by default. */
  reciterId: number;
  moshafId: number;
  favReciters: number[];
  favStations: number[];
  /** The listening wird: a juz a day, ayah by ayah, with this everyayah.com reciter. */
  wirdReciter: string;
};

export type AppSettings = {
  theme: ThemeMode;
  palette: PaletteId;
  nav: NavStyle;
  madhab: Madhab;
  adhan: AdhanSettings;
  /** The reciter of the mushaf's ayah-by-ayah listening (everyayah.com, src/lib/ayah-audio.ts). */
  reciter: string;
  /** The mushaf page's look (src/lib/image-styles.ts; «كلاسيكي» follows light and dark), as the site's reading pref. */
  pageStyle: ImageStyleId;
  /** The look of ayah and page images and wallpapers (/api/mushaf-image `style`). */
  imageStyle: ImageStyleId;
  /** «خط كبير»: every text a size up. */
  large: boolean;
  /** The colour-coded tajweed mushaf (QCF V4; Android 13+, on a light page). */
  tajweed: boolean;
  reminders: Reminders;
  listen: Listen;
  /** Hadith text without its diacritics (the site's reading pref hadithPlain). */
  hadithPlain: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  palette: DEFAULT_PALETTE,
  nav: "solid",
  madhab: "shafi",
  adhan: {
    enabled: false,
    prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
    sunrise: false,
    before: 0,
    voice: ADHAN_VOICES[0][0],
    morning: true,
    evening: true,
  },
  reciter: DEFAULT_AYAH_RECITER,
  pageStyle: DEFAULT_IMAGE_STYLE,
  imageStyle: DEFAULT_IMAGE_STYLE,
  large: false,
  tajweed: false,
  reminders: {
    zikr: { on: false, every: 60 },
    kahf: false,
    alarm: { on: false, mode: "fajr", before: 30, time: "05:00", play: "surah", surah: 67, station: 0 },
    occasions: { on: false, kinds: DEFAULT_REMINDER_OCCASIONS },
  },
  listen: { reciterId: 123, moshafId: 123, favReciters: [], favStations: [], wirdReciter: DEFAULT_AYAH_RECITER },
  hadithPlain: false,
};

const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback;

/** Saved settings with anything unknown or invalid replaced by the default. */
export function normalizeSettings(raw: unknown): AppSettings {
  const d = DEFAULT_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const x = raw as Partial<Record<keyof AppSettings, unknown>>;
  const a = (x.adhan && typeof x.adhan === "object" ? x.adhan : {}) as Partial<Record<keyof AdhanSettings, unknown>>;
  const p = (a.prayers && typeof a.prayers === "object" ? a.prayers : {}) as Partial<Record<Salah, unknown>>;
  return {
    theme: oneOf(x.theme, ["system", "light", "dark"], d.theme),
    palette: isPalette(x.palette) ? x.palette : d.palette,
    nav: oneOf(x.nav, ["solid", "glass", "minimal"], d.nav),
    madhab: oneOf(x.madhab, ["shafi", "hanafi"], d.madhab),
    adhan: {
      enabled: typeof a.enabled === "boolean" ? a.enabled : d.adhan.enabled,
      prayers: Object.fromEntries(SALAH.map((k) => [k, typeof p[k] === "boolean" ? p[k] : d.adhan.prayers[k]])) as Record<Salah, boolean>,
      sunrise: typeof a.sunrise === "boolean" ? a.sunrise : d.adhan.sunrise,
      before: BEFORE_OPTIONS.includes(a.before as (typeof BEFORE_OPTIONS)[number]) ? (a.before as number) : d.adhan.before,
      voice: isAdhanVoice(a.voice) ? a.voice : d.adhan.voice,
      morning: typeof a.morning === "boolean" ? a.morning : d.adhan.morning,
      evening: typeof a.evening === "boolean" ? a.evening : d.adhan.evening,
    },
    reciter: AYAH_RECITERS.some((r) => r.id === x.reciter) ? (x.reciter as string) : d.reciter,
    pageStyle: isImageStyle(x.pageStyle) ? x.pageStyle : d.pageStyle,
    imageStyle: isImageStyle(x.imageStyle) ? x.imageStyle : d.imageStyle,
    large: typeof x.large === "boolean" ? x.large : d.large,
    tajweed: typeof x.tajweed === "boolean" ? x.tajweed : d.tajweed,
    reminders: normalizeReminders(x.reminders),
    listen: normalizeListen(x.listen),
    hadithPlain: x.hadithPlain === true,
  };
}

function normalizeReminders(raw: unknown): Reminders {
  const d = DEFAULT_SETTINGS.reminders;
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Reminders, unknown>>;
  const z = (r.zikr && typeof r.zikr === "object" ? r.zikr : {}) as Partial<Record<string, unknown>>;
  const a = (r.alarm && typeof r.alarm === "object" ? r.alarm : {}) as Partial<Record<string, unknown>>;
  const o = (r.occasions && typeof r.occasions === "object" ? r.occasions : {}) as Partial<Record<string, unknown>>;
  const int = (v: unknown, min: number, max: number, fallback: number) => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : fallback);
  return {
    zikr: { on: z.on === true, every: ZIKR_EVERY.includes(z.every as (typeof ZIKR_EVERY)[number]) ? (z.every as number) : d.zikr.every },
    kahf: r.kahf === true,
    alarm: {
      on: a.on === true,
      mode: a.mode === "time" ? "time" : "fajr",
      before: ALARM_BEFORE.includes(a.before as (typeof ALARM_BEFORE)[number]) ? (a.before as number) : d.alarm.before,
      time: typeof a.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(a.time) ? a.time : d.alarm.time,
      play: a.play === "live" ? "live" : "surah",
      surah: int(a.surah, 1, 114, d.alarm.surah),
      station: int(a.station, 0, 100_000, d.alarm.station),
    },
    occasions: {
      on: o.on === true,
      kinds: Array.isArray(o.kinds) ? REMINDER_OCCASIONS.filter((k) => (o.kinds as unknown[]).includes(k)) : d.occasions.kinds,
    },
  };
}

function normalizeListen(raw: unknown): Listen {
  const d = DEFAULT_SETTINGS.listen;
  const l = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Listen, unknown>>;
  const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is number => Number.isInteger(x) && x > 0))].slice(0, 100) : []);
  const ok = Number.isInteger(l.reciterId) && Number.isInteger(l.moshafId);
  return {
    reciterId: ok ? (l.reciterId as number) : d.reciterId,
    moshafId: ok ? (l.moshafId as number) : d.moshafId,
    favReciters: ids(l.favReciters),
    favStations: ids(l.favStations),
    wirdReciter: AYAH_RECITERS.some((r) => r.id === l.wirdReciter) ? (l.wirdReciter as string) : d.wirdReciter,
  };
}
