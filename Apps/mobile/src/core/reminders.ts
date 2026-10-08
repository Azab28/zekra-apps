/**
 * The reminders beside the adhan, worked out on the phone: the occasions (the
 * rules of src/lib/schedule/occasion-days.ts, which reads the server's Hijri
 * offset from the database, so they're followed here with hijri-core and the
 * offset the app keeps), the Quran alarm's next times (the extension's
 * lib/listen.ts), and the zikr phrases (cut out of hisn.json the way the
 * extension's build does, so the words are Hisn al-Muslim's own).
 */
import { DateTime } from "luxon";
import { stripTashkeel, toArabicDigits } from "@lib/content/arabic";
import { hisn } from "@lib/content/data";
import { hijriMonthName, hijriOf, type HijriDate } from "@lib/hijri-core";
import { prayerTimesFor, type Place } from "@lib/schedule/prayer-calc";
import { dayAt } from "./prayer";
import type { ReminderOccasion, Reminders } from "./settings";

const n = toArabicDigits;

export type Reminder = { at: Date; title: string; body: string; url?: string };

// ---------- zikr ----------

/** The phrases (as the extension's ZIKR_KEYS), each found in hisn.json and cut out with its own diacritics. */
const ZIKR_KEYS = [
  "سبحان الله",
  "الحمد لله",
  "لا إله إلا الله",
  "الله أكبر",
  "أستغفر الله",
  "لا حول ولا قوة إلا بالله",
  "اللهم صل على محمد وعلى آل محمد",
  "سبحان الله وبحمده",
  "سبحان الله وبحمده سبحان الله العظيم",
];

const fold = (t: string) =>
  stripTashkeel(t)
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[ـ،,.؛()]/g, "")
    .replace(/\s+/g, " ");

let phrases: string[] | null = null;

export function zikrPhrases(): string[] {
  if (phrases) return phrases;
  const items = hisn().chapters.flatMap((c) => c.items.map((i) => i.text));
  phrases = ZIKR_KEYS.flatMap((key) => {
    const want = fold(key);
    for (const text of items) {
      // The folded text, each letter remembering where it was in the original.
      const at: number[] = [];
      let folded = "";
      for (let i = 0; i < text.length; i++)
        for (const x of fold(text[i])) {
          if (x === " " && folded.endsWith(" ")) continue;
          folded += x;
          at.push(i);
        }
      const k = folded.indexOf(want);
      if (k < 0) continue;
      let end = at[k + want.length - 1] + 1;
      while (end < text.length && /[ً-ٰٟۖ-ۭ]/.test(text[end])) end++;
      return [text.slice(at[k], end).trim()];
    }
    return [];
  });
  return phrases;
}

// ---------- occasions ----------

const isEid = (h: HijriDate) => (h.month === 10 && h.day === 1) || (h.month === 12 && h.day === 10);
const noFasting = (h: HijriDate) => isEid(h) || (h.month === 12 && h.day >= 11 && h.day <= 13);
const QADR_EVENINGS = [20, 22, 24, 26, 28];

/** The voluntary fasts on a day (as occasion-days.ts fastingReasons), by name. */
function fasts(day: DateTime, offset: number): { weekly: string[]; other: string[] } {
  const h = hijriOf(day, offset);
  if (h.month === 9 || noFasting(h)) return { weekly: [], other: [] };
  const other: string[] = [];
  if (h.month === 12 && h.day === 9) other.push("يوم عرفة");
  if (h.month === 1 && h.day === 9) other.push("تاسوعاء");
  if (h.month === 1 && h.day === 10) other.push("عاشوراء");
  if (h.day >= 13 && h.day <= 15) other.push("الأيام البيض");
  const weekly = day.weekday === 1 ? ["الاثنين"] : day.weekday === 4 ? ["الخميس"] : [];
  return { weekly, other };
}

/** The occasions' reminders on the coming days, for this place (times from prayer-calc). */
export function occasionReminders(kinds: ReminderOccasion[], place: Place, offset: number, now: number, days: number): Reminder[] {
  const on = (k: ReminderOccasion) => kinds.includes(k);
  const out: Reminder[] = [];
  for (let d = 0; d < days; d++) {
    const day = dayAt(place.timezone, now, d);
    const h = hijriOf(day, offset);
    const t = prayerTimesFor(day, place);
    const plus = (at: Date, minutes: number) => new Date(at.getTime() + minutes * 60_000);
    const clock = (hour: number, minute = 0) => day.set({ hour, minute }).toJSDate();
    const push = (at: Date, title: string, body: string, url?: string) => out.push({ at, title, body, url });

    // Tomorrow's fasts, the evening before (one reminder naming them all).
    const f = fasts(day.plus({ days: 1 }), offset);
    const names = [...(on("fasting") ? f.other : []), ...(on("fasting_weekly") ? f.weekly : [])];
    if (names.length) push(clock(21), `غدًا صيام ${names.join(" و")}`, "تذكير بالصيام، تقبّل الله منك", "/hijri");

    if (h.month === 9 && on("suhoor")) push(plus(t.fajr, -45), "السحور", "قبل أذان الفجر بخمس وأربعين دقيقة", "/ramadan");
    if (h.month === 9 && on("iftar")) push(t.maghrib, "حان وقت الإفطار", "تقبّل الله صيامكم", "/azkar/68");
    if (h.month === 9 && QADR_EVENINGS.includes(h.day) && on("qadr_nights")) push(plus(t.isha, 30), `الليلة ليلة ${n(h.day + 1)} من رمضان`, "من ليالي الوتر في العشر الأواخر", "/surah/97");
    if (h.month === 12 && h.day === 9 && on("arafah")) {
      for (const at of [plus(t.fajr, 30), plus(t.dhuhr, 20), plus(t.asr, 20), plus(t.maghrib, -60)]) push(at, "يوم عرفة", "أكثِر من الذكر والدعاء", "/hijri");
    } else if (h.month === 12 && h.day <= 9 && on("dhul_hijjah")) push(clock(10), `عشر ذي الحجة: اليوم ${n(h.day)}`, "من الأيام العشر الأولى من ذي الحجة", "/hijri");
    if (h.day === 1 && !isEid(h) && on("hijri_month")) push(clock(8), `بداية شهر ${hijriMonthName(day, offset)}`, "دعاء رؤية الهلال", "/hijri");
    if (isEid(h) && on("eid")) push(clock(7, 30), "عيد مبارك", "كل عام وأنتم بخير", "/hijri");
    if (on("duha")) push(plus(t.sunrise, 15), "صلاة الضحى", "دخل وقت صلاة الضحى", "/prayer");
    if (on("qiyam")) {
      // The last third of the night that ends with this day's fajr.
      const maghrib = prayerTimesFor(day.minus({ days: 1 }), place).maghrib.getTime();
      push(new Date(maghrib + (t.fajr.getTime() - maghrib) * (2 / 3)), "قيام الليل", "بدأ الثلث الأخير من الليل", "/prayer");
    }
  }
  return out.filter((r) => r.at.getTime() > now + 5_000);
}

// ---------- the Quran alarm ----------

/** The alarm's next few times (the extension's nextAlarm): before fajr where the place is known, or at a set time. */
export function alarmTimes(a: Reminders["alarm"], place: Place | null, now: number, days = 3): Date[] {
  if (!a.on) return [];
  const out: Date[] = [];
  for (let d = 0; d <= days; d++) {
    if (a.mode === "fajr") {
      if (!place) return [];
      out.push(new Date(prayerTimesFor(dayAt(place.timezone, now, d), place).fajr.getTime() - a.before * 60_000));
    } else {
      const [hh, mm] = a.time.split(":").map(Number);
      const zone = place?.timezone;
      const base = (zone ? DateTime.fromMillis(now).setZone(zone) : DateTime.fromMillis(now)).startOf("day").plus({ days: d });
      out.push(base.set({ hour: hh, minute: mm }).toJSDate());
    }
  }
  return out.filter((at) => at.getTime() > now + 5_000);
}
