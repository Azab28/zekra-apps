/** Prayer times for the chosen place and the reminders built on them. */
import { DateTime } from "luxon";
import { toArabicDigits } from "../../../../src/lib/content/arabic";
import { PRAYER_LABELS, PRAYER_NAMES, prayerTimesFor } from "../../../../src/lib/schedule/prayer-calc";
import type { PrayerName } from "../../../../src/lib/types";
import { ADHAN_PRAYERS, type AdhanPrayer, type ExtPlace, type Settings } from "./settings";

export { PRAYER_LABELS, PRAYER_NAMES };
export const n = toArabicDigits;

/** The place's calendar day `days` from today. */
export const placeDay = (place: ExtPlace, days = 0, now = Date.now()) =>
  DateTime.fromMillis(now, { zone: place.timezone }).startOf("day").plus({ days });

export const timesOn = (place: ExtPlace, day: DateTime) => prayerTimesFor(day, place);

/** The next adhan (sunrise excluded) after `now`, looking into tomorrow when today's are over. */
export function nextPrayer(place: ExtPlace, now = Date.now()): { prayer: AdhanPrayer; at: Date } {
  for (const d of [0, 1]) {
    const t = timesOn(place, placeDay(place, d, now));
    for (const p of ADHAN_PRAYERS) if (t[p].getTime() > now) return { prayer: p, at: t[p] };
  }
  // Only reachable where a day has no isha/fajr at all (polar days); keep something sensible.
  return { prayer: "fajr", at: new Date(now + 86_400_000) };
}

export function formatTime(date: Date, timeZone: string, clock24: boolean): string {
  return new Intl.DateTimeFormat("ar-EG", { hour: "numeric", minute: "2-digit", hour12: !clock24, timeZone }).format(date);
}

/** «٢:٠٥» (hours and minutes) or «٤٥ د» under an hour; always rounded up to the minute. */
export function countdown(ms: number): string {
  const mins = Math.max(0, Math.ceil(ms / 60_000));
  if (mins < 60) return `${n(mins)} د`;
  return `${n(Math.floor(mins / 60))}:${n(String(mins % 60).padStart(2, "0"))}`;
}

/** Arabic count of minutes: «دقيقة واحدة», «دقيقتان», «٥ دقائق», «١٥ دقيقة». */
export function minutesLabel(m: number): string {
  if (m === 1) return "دقيقة واحدة";
  if (m === 2) return "دقيقتان";
  if (m >= 3 && m <= 10) return `${n(m)} دقائق`;
  return `${n(m)} دقيقة`;
}

export type ReminderKind = "adhan" | "before" | "morning" | "evening";
export type Reminder = { at: number; kind: ReminderKind; prayer?: AdhanPrayer };

/** Morning azkar this long after fajr, evening azkar this long after asr. */
export const AZKAR_AFTER_MINUTES = 30;

/** Every reminder the settings ask for, from `now` over the next day and a bit, soonest first. */
export function upcomingReminders(s: Settings, now = Date.now()): Reminder[] {
  const place = s.place;
  if (!place || s.notify.paused) return [];
  const out: Reminder[] = [];
  for (const d of [0, 1]) {
    const t = timesOn(place, placeDay(place, d, now));
    for (const p of ADHAN_PRAYERS) {
      if (!s.notify.prayers[p]) continue;
      if (s.notify.atAdhan) out.push({ at: t[p].getTime(), kind: "adhan", prayer: p });
      if (s.notify.before > 0) out.push({ at: t[p].getTime() - s.notify.before * 60_000, kind: "before", prayer: p });
    }
    if (s.notify.azkar) {
      out.push({ at: t.fajr.getTime() + AZKAR_AFTER_MINUTES * 60_000, kind: "morning" });
      out.push({ at: t.asr.getTime() + AZKAR_AFTER_MINUTES * 60_000, kind: "evening" });
    }
  }
  return out.filter((r) => r.at > now).sort((a, b) => a.at - b.at);
}

/**
 * The azkar window the moment falls in, if any: the morning's runs from its
 * reminder until dhuhr, the evening's from its reminder until isha. A browser
 * opened late still gets that day's reminder once.
 */
export function azkarWindow(place: ExtPlace, now = Date.now()): { kind: "morning" | "evening"; day: string } | null {
  const day = placeDay(place, 0, now);
  const t = timesOn(place, day);
  const after = AZKAR_AFTER_MINUTES * 60_000;
  const key = day.toISODate()!;
  if (now >= t.fajr.getTime() + after && now < t.dhuhr.getTime()) return { kind: "morning", day: key };
  if (now >= t.asr.getTime() + after && now < t.isha.getTime()) return { kind: "evening", day: key };
  return null;
}

export const prayerLabel = (p: PrayerName) => PRAYER_LABELS[p];
