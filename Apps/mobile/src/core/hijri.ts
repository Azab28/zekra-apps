/** Hijri dates through src/lib/hijri-core with the site's offset; null where the phone's Intl lacks the Umm al-Qura calendar. */
import type { DateTime } from "luxon";
import { hijriLabel, hijriOf } from "@lib/hijri-core";

export function hijriText(day: DateTime, offset: number): string | null {
  try {
    const h = hijriOf(day, offset);
    // A Gregorian year or NaN means the calendar isn't supported here.
    if (!(h.year > 1300 && h.year < 1700 && h.month >= 1 && h.month <= 12)) return null;
    return hijriLabel(day, offset);
  } catch {
    return null;
  }
}
