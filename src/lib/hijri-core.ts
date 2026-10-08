/**
 * Hijri dates (Umm al-Qura via Intl) with an explicit day offset, and the
 * yearly occasions. No database: safe in the browser (the website passes the
 * admin's offset in); src/lib/hijri.ts adds the stored offset for the server.
 */
import { DateTime } from "luxon";

export type HijriDate = { day: number; month: number; year: number };

const numeric = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** Noon (UTC) of the calendar day, shifted by the offset: avoids timezone edge cases. */
const anchor = (day: DateTime, offset: number) => new Date(Date.UTC(day.year, day.month - 1, day.day + offset, 12));

/** The Hijri date of a local calendar day. */
export function hijriOf(day: DateTime, offset = 0): HijriDate {
  const parts = numeric.formatToParts(anchor(day, offset));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { day: get("day"), month: get("month"), year: get("year") };
}

/** e.g. «١٧ ربيع الآخر ١٤٤٨ هـ». */
export function hijriLabel(day: DateTime, offset = 0): string {
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(anchor(day, offset));
}

export function hijriMonthName(day: DateTime, offset = 0): string {
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { month: "long", timeZone: "UTC" }).format(
    anchor(day, offset),
  );
}

/** Yearly occasions by Hijri date (the calendar's «upcoming» list). */
export const HIJRI_EVENTS: { label: string; match: (h: HijriDate) => boolean }[] = [
  { label: "🌙 رمضان", match: (h) => h.month === 9 && h.day === 1 },
  { label: "🎉 عيد الفطر", match: (h) => h.month === 10 && h.day === 1 },
  { label: "🕋 يوم عرفة", match: (h) => h.month === 12 && h.day === 9 },
  { label: "🐑 عيد الأضحى", match: (h) => h.month === 12 && h.day === 10 },
  { label: "📅 رأس السنة الهجرية", match: (h) => h.month === 1 && h.day === 1 },
  { label: "🤍 يوم عاشوراء", match: (h) => h.month === 1 && h.day === 10 },
  { label: "🌕 الأيام البيض", match: (h) => h.day === 13 },
];

/** The next date of each occasion from `today` on (within about a year), soonest first. */
export function upcomingEvents(today: DateTime, offset = 0, searchDays = 400): { label: string; days: number; date: DateTime }[] {
  const out: { label: string; days: number; date: DateTime }[] = [];
  for (const e of HIJRI_EVENTS) {
    for (let d = 0; d <= searchDays; d++) {
      const day = today.plus({ days: d });
      if (e.match(hijriOf(day, offset))) {
        out.push({ label: e.label, days: d, date: day });
        break;
      }
    }
  }
  return out.sort((a, b) => a.days - b.days);
}

/** First day of the Hijri month `months` away from the one `today` is in. */
export function hijriMonthStart(today: DateTime, months: number, offset = 0): DateTime {
  let d = today.minus({ days: hijriOf(today, offset).day - 1 });
  for (let k = 0; k < months; k++) {
    d = d.plus({ days: 30 });
    d = d.minus({ days: hijriOf(d, offset).day - 1 });
  }
  for (let k = 0; k > months; k--) {
    d = d.minus({ days: 1 });
    d = d.minus({ days: hijriOf(d, offset).day - 1 });
  }
  return d;
}

/** 0 in Ramadan, else the days until its 1st (for showing Ramadan tools only around it). */
export function daysToRamadan(today: DateTime, offset = 0): number {
  let day = today.startOf("day");
  for (let k = 0; k < 400; k++, day = day.plus({ days: 1 })) {
    if (hijriOf(day, offset).month === 9) return k;
  }
  return 400;
}
