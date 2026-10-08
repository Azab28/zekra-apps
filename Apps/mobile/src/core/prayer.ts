/**
 * Prayer times for the saved place, all from src/lib (prayer-calc, cities):
 * this file only picks days, the next prayer and how to show a time.
 */
import { DateTime } from "luxon";
import { getCalendars } from "expo-localization";
import { NEAR_KM, nearestCity } from "@lib/cities";
import { toArabicDigits } from "@lib/content/arabic";
import { PRAYER_LABELS, prayerTimesFor, type Place } from "@lib/schedule/prayer-calc";
import type { SitePlace } from "@lib/site-prefs";
import type { PrayerName } from "@lib/types";
import type { Madhab } from "./settings";

export const ORDER: PrayerName[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
const n = toArabicDigits;

/** The saved place with this device's Asr madhab, as prayer-calc takes it. */
export const calcPlace = (p: SitePlace, madhab: Madhab): Place => ({ ...p, madhab });

/** A calendar day in the place's own timezone, `ahead` days from now. */
export const dayAt = (zone: string, now: number, ahead = 0) => DateTime.fromMillis(now).setZone(zone).startOf("day").plus({ days: ahead });

/** «الجمعة» for dhuhr on Fridays. */
export const prayerLabel = (k: PrayerName, day: DateTime) => (k === "dhuhr" && day.weekday === 5 ? "الجمعة" : PRAYER_LABELS[k]);

/** The next prayer (sunrise isn't one) after `now`, tomorrow's fajr after isha. */
export function nextPrayer(place: Place, now: number): { name: PrayerName; label: string; at: Date } {
  const today = dayAt(place.timezone, now);
  const times = prayerTimesFor(today, place);
  const name = ORDER.filter((k) => k !== "sunrise").find((k) => times[k].getTime() > now);
  if (name) return { name, label: prayerLabel(name, today), at: times[name] };
  return { name: "fajr", label: PRAYER_LABELS.fajr, at: prayerTimesFor(today.plus({ days: 1 }), place).fajr };
}

/** «٤:٣٥ م» in the place's timezone. */
export function fmtTime(d: Date, zone: string): string {
  const t = DateTime.fromJSDate(d).setZone(zone);
  const h = t.hour % 12 || 12;
  return `${n(h)}:${n(String(t.minute).padStart(2, "0"))} ${t.hour < 12 ? "ص" : "م"}`;
}

/** «ساعتين و١٠ دقائق» (as on the site's /prayer). */
export function untilPhrase(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h === 1 ? "ساعة" : h === 2 ? "ساعتين" : h > 0 ? `${n(h)} ${h <= 10 ? "ساعات" : "ساعة"}` : "";
  const mins = m === 1 ? "دقيقة" : m === 2 ? "دقيقتين" : m > 0 ? `${n(m)} ${m <= 10 ? "دقائق" : "دقيقة"}` : "";
  return [hours, mins].filter(Boolean).join(" و") || "أقل من دقيقة";
}

/** «الأربعاء ٧ أكتوبر ٢٠٢٦». */
export const dateLine = (day: DateTime) =>
  new Intl.DateTimeFormat("ar-EG", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(day.year, day.month - 1, day.day, 12)),
  );

/** This device's timezone (exact for where it is). */
export function deviceZone(): string | null {
  try {
    return getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

/** The place for a device location: the nearest listed city when close, else the exact point (as on the site). */
export function placeAt(latitude: number, longitude: number): SitePlace {
  const near = nearestCity(latitude, longitude);
  const close = near.d <= NEAR_KM;
  return {
    city: close ? `${near.c.name} (موقعك)` : "موقعك",
    timezone: deviceZone() || near.c.timezone,
    latitude: Math.round(latitude * 1e4) / 1e4,
    longitude: Math.round(longitude * 1e4) / 1e4,
    calcMethod: close ? near.c.calcMethod : "MuslimWorldLeague",
  };
}
