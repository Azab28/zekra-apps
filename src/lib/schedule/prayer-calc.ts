// Prayer-time calculation (adhan), shared by schedules, occasions and the prayer-times post.
import { CalculationMethod, Coordinates, Madhab, PrayerTimes, type CalculationParameters } from "adhan";
import type { DateTime } from "luxon";
import type { PrayerAdjust, PrayerName } from "../types";

export type Place = {
  timezone: string;
  latitude: number;
  longitude: number;
  calcMethod: string;
  /** Minutes per prayer on top of the calculation (e.g. fajr +2 to match the local mosque). */
  prayerAdjust?: PrayerAdjust | null;
  /** Asr by the Hanafi shadow length (twice the object); Shafi'i (once) when unset. */
  madhab?: "shafi" | "hanafi";
};

export const PRAYER_NAMES: PrayerName[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
/** Adjustments are small corrections, not a way to move a prayer. */
export const MAX_ADJUST_MINUTES = 30;

/** Whole minutes within ±MAX_ADJUST_MINUTES for known prayers only; null when nothing is adjusted. */
export function normalizeAdjust(value: unknown): PrayerAdjust | null {
  if (!value || typeof value !== "object") return null;
  const out: PrayerAdjust = {};
  for (const name of PRAYER_NAMES) {
    const v = Math.round(Number((value as Record<string, unknown>)[name]));
    if (Number.isFinite(v) && v !== 0) out[name] = Math.max(-MAX_ADJUST_MINUTES, Math.min(MAX_ADJUST_MINUTES, v));
  }
  return Object.keys(out).length ? out : null;
}

/** Cache key part, e.g. "fajr2,isha-5" (empty when nothing is adjusted). */
export const adjustKey = (a: PrayerAdjust | null | undefined) =>
  a ? PRAYER_NAMES.filter((k) => a[k]).map((k) => `${k}${a[k]}`).join(",") : "";

/** Back from adjustKey (e.g. a URL parameter); anything unknown is dropped. */
export function parseAdjustKey(key: string | null | undefined): PrayerAdjust | null {
  const out: Record<string, number> = {};
  for (const part of (key ?? "").split(",").slice(0, PRAYER_NAMES.length)) {
    const m = /^([a-z]+)(-?\d{1,2})$/.exec(part);
    if (m) out[m[1]] = Number(m[2]);
  }
  return normalizeAdjust(out);
}

export const CALC_METHODS: Record<string, { label: string; params: () => CalculationParameters }> = {
  Egyptian: { label: "الهيئة المصرية العامة للمساحة", params: () => CalculationMethod.Egyptian() },
  UmmAlQura: { label: "أم القرى (السعودية)", params: () => CalculationMethod.UmmAlQura() },
  MuslimWorldLeague: { label: "رابطة العالم الإسلامي", params: () => CalculationMethod.MuslimWorldLeague() },
  Dubai: { label: "دبي", params: () => CalculationMethod.Dubai() },
  Kuwait: { label: "الكويت", params: () => CalculationMethod.Kuwait() },
  Qatar: { label: "قطر", params: () => CalculationMethod.Qatar() },
  Karachi: { label: "جامعة العلوم الإسلامية بكراتشي", params: () => CalculationMethod.Karachi() },
  Turkey: { label: "تركيا (ديانت)", params: () => CalculationMethod.Turkey() },
  Singapore: { label: "سنغافورة", params: () => CalculationMethod.Singapore() },
  NorthAmerica: { label: "أمريكا الشمالية (ISNA)", params: () => CalculationMethod.NorthAmerica() },
  MoonsightingCommittee: {
    label: "لجنة رؤية الهلال",
    params: () => CalculationMethod.MoonsightingCommittee(),
  },
};

/** A known method name (own keys only: `in` would also accept "constructor", "toString"…). */
export const isCalcMethod = (m: unknown): m is string => typeof m === "string" && Object.hasOwn(CALC_METHODS, m);

export const PRAYER_LABELS: Record<PrayerName, string> = {
  fajr: "الفجر",
  sunrise: "الشروق",
  dhuhr: "الظهر",
  asr: "العصر",
  maghrib: "المغرب",
  isha: "العشاء",
};

export function prayerTimesFor(day: DateTime, place: Place): Record<PrayerName, Date> {
  const params = CALC_METHODS[isCalcMethod(place.calcMethod) ? place.calcMethod : "Egyptian"].params();
  // adhan reads the calendar date from the Date's local Y/M/D components.
  const date = new Date(day.year, day.month - 1, day.day);
  const adjust = normalizeAdjust(place.prayerAdjust);
  if (adjust) for (const k of PRAYER_NAMES) params.adjustments[k] += adjust[k] ?? 0;
  if (place.madhab === "hanafi") params.madhab = Madhab.Hanafi;
  const pt = new PrayerTimes(new Coordinates(place.latitude, place.longitude), date, params);
  return {
    fajr: pt.fajr,
    sunrise: pt.sunrise,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
  };
}
