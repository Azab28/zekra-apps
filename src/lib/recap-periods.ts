/**
 * «حصادي» periods of a Hijri year: each month, the four quarters (3 months),
 * the two halves (6 months) and the whole year. Pure and client-safe; the
 * dates of a period are worked out on the server (src/lib/recap.ts).
 *
 * Keys: "1448-m3" (Rabi' al-Awwal), "1448-q1", "1448-h2", "1448-y".
 * The thirds (4 months) are gone: an old "4" (a length) falls back to the quarter.
 */
import { toArabicDigits } from "./content/arabic";

const n = toArabicDigits;

export const HIJRI_MONTHS = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة",
] as const;

const ORD = ["الأول", "الثاني", "الثالث", "الرابع"] as const;

export const PERIOD_KINDS = ["month", "quarter", "half", "year"] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

/** Months in each kind, and how many of it fit in a year. */
export const KIND_MONTHS: Record<PeriodKind, 1 | 3 | 6 | 12> = { month: 1, quarter: 3, half: 6, year: 12 };
export const KIND_NAMES: Record<PeriodKind, string> = { month: "شهر", quarter: "ربع", half: "نصف", year: "عام" };
const KIND_LETTER: Record<PeriodKind, string> = { month: "m", quarter: "q", half: "h", year: "y" };

/** One period: `index` is the month (1–12), quarter (1–4), half (1–2), or 1 for the year. */
export type HijriPeriod = { year: number; kind: PeriodKind; index: number };

export const periodCount = (kind: PeriodKind) => 12 / KIND_MONTHS[kind];

export function periodKey(p: HijriPeriod): string {
  return p.kind === "year" ? `${p.year}-y` : `${p.year}-${KIND_LETTER[p.kind]}${p.index}`;
}

export function parsePeriodKey(key: unknown): HijriPeriod | null {
  if (typeof key !== "string") return null;
  const m = /^(\d{4})-(?:(y)|([mqh])(\d{1,2}))$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  if (year < 1300 || year > 1600) return null;
  if (m[2]) return { year, kind: "year", index: 1 };
  const kind = (({ m: "month", q: "quarter", h: "half" }) as const)[m[3] as "m" | "q" | "h"];
  const index = Number(m[4]);
  return index >= 1 && index <= periodCount(kind) && String(index) === m[4] ? { year, kind, index } : null;
}

/** The first and last Hijri month (1–12) of a period. */
export function periodMonths(p: HijriPeriod): { first: number; last: number } {
  const len = KIND_MONTHS[p.kind];
  const last = p.kind === "year" ? 12 : p.index * len;
  return { first: last - len + 1, last };
}

/** «شهر ربيع الأول ١٤٤٨ هـ», «الربع الأول من عام ١٤٤٨ هـ», «النصف الثاني من عام ١٤٤٧ هـ», «عام ١٤٤٨ هـ». */
export function periodLabel(p: HijriPeriod): string {
  if (p.kind === "year") return `عام ${n(p.year)} هـ`;
  if (p.kind === "month") return `شهر ${HIJRI_MONTHS[p.index - 1]} ${n(p.year)} هـ`;
  return `${p.kind === "quarter" ? "الربع" : "النصف"} ${ORD[p.index - 1]} من عام ${n(p.year)} هـ`;
}

/** A picker button's text: the month's name, «الأول»…, or the year. */
export function periodShort(p: HijriPeriod): string {
  if (p.kind === "year") return `${n(p.year)} هـ`;
  return p.kind === "month" ? HIJRI_MONTHS[p.index - 1] : ORD[p.index - 1];
}

/** The months a quarter or half covers: «من محرم إلى ربيع الأول», «من شوال إلى ذي الحجة»; empty for a month or the year. */
export function periodSpan(p: HijriPeriod): string {
  if (p.kind === "month" || p.kind === "year") return "";
  const { first, last } = periodMonths(p);
  return `من ${HIJRI_MONTHS[first - 1]} إلى ${HIJRI_MONTHS[last - 1].replace(/^ذو /, "ذي ")}`;
}

/**
 * The longest period ending with Hijri month `month` of `year` — what the bot
 * sends on the next 1st: the year (Dhu al-Hijjah), the first half (Jumada
 * al-Akhirah), the first or third quarter (Rabi' al-Awwal, Ramadan), else the
 * month. The second half and the 2nd/4th quarters end with the year or the
 * first half, which cover them.
 */
export function endingPeriod(month: number, year: number): HijriPeriod {
  if (month === 12) return { year, kind: "year", index: 1 };
  if (month % 6 === 0) return { year, kind: "half", index: month / 6 };
  if (month % 3 === 0) return { year, kind: "quarter", index: month / 3 };
  return { year, kind: "month", index: month };
}

/** Every period of a year, in picker order: the months, quarters, halves, then the year. */
export function periodsOfYear(year: number): HijriPeriod[] {
  return PERIOD_KINDS.flatMap((kind) => Array.from({ length: periodCount(kind) }, (_, i) => ({ year, kind, index: i + 1 })));
}

/** An old length in months (1, 3, 4, 6, 12) → its kind; a third (4) falls back to the quarter. */
export function kindOfLength(months: unknown): PeriodKind | null {
  const m = typeof months === "string" && /^\d{1,2}$/.test(months) ? Number(months) : months;
  return m === 1 ? "month" : m === 3 || m === 4 ? "quarter" : m === 6 ? "half" : m === 12 ? "year" : null;
}

/** A kind by name ("quarter") or old length ("3"); null otherwise. */
export function periodKindOf(v: unknown): PeriodKind | null {
  if (typeof v === "string" && (PERIOD_KINDS as readonly string[]).includes(v)) return v as PeriodKind;
  return kindOfLength(v);
}
