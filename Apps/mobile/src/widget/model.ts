/**
 * What the home-screen widget shows, computed on the phone from what the app
 * last saved for it (`widget` in storage: the place, the Asr madhab and the
 * Hijri offset): the city, today's dates, the five prayers and the next one.
 * Free of the widget library, so the app can import it anywhere.
 */
import { prayerTimesFor } from "@lib/schedule/prayer-calc";
import type { SitePlace } from "@lib/site-prefs";
import { hijriText } from "@/core/hijri";
import { calcPlace, dateLine, dayAt, fmtTime, prayerLabel } from "@/core/prayer";
import type { Madhab } from "@/core/settings";
import { SALAH } from "@/core/settings";

export type WidgetSnapshot = { place: SitePlace | null; madhab: Madhab; hijriOffset: number };
export const WIDGET_KEY = "widget";
export const WIDGET_NAME = "Prayer";

export type WidgetModel =
  | { kind: "none" }
  | {
      kind: "times";
      city: string;
      date: string;
      prayers: { key: string; label: string; time: string; next: boolean }[];
      next: { label: string; time: string };
    };

export function widgetModel(s: WidgetSnapshot | null, now = Date.now()): WidgetModel {
  if (!s?.place) return { kind: "none" };
  const p = calcPlace(s.place, s.madhab);
  const day = dayAt(p.timezone, now);
  const times = prayerTimesFor(day, p);
  let upcoming = SALAH.find((k) => times[k].getTime() > now) ?? null;
  // After isha: tomorrow's fajr.
  const nextAt = upcoming ? times[upcoming] : prayerTimesFor(dayAt(p.timezone, now, 1), p).fajr;
  if (!upcoming) upcoming = "fajr";
  return {
    kind: "times",
    city: s.place.city,
    date: hijriText(day, s.hijriOffset) ?? dateLine(day),
    prayers: SALAH.map((k) => ({ key: k, label: prayerLabel(k, day), time: fmtTime(times[k], p.timezone).replace(/ [صم]$/, ""), next: k === upcoming })),
    next: { label: prayerLabel(upcoming, day), time: fmtTime(nextAt, p.timezone) },
  };
}
