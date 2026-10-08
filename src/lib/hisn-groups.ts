/**
 * Hisn al-Muslim's chapters in sections for the website's azkar index (by
 * chapter id, in data/hisn.json's order). Client-safe; every id is in exactly
 * one section (checked by the tests).
 */
export type HisnGroupIcon = "day" | "mosque" | "home" | "relief" | "illness" | "food" | "rain" | "travel" | "hajj" | "people";
export type HisnGroup = { title: string; icon: HisnGroupIcon; ids: number[] };

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export const HISN_GROUPS: HisnGroup[] = [
  { title: "اليوم والليلة", icon: "day", ids: [1, 27, 28, 29, 30, 31, 129, 130, 131, 107] },
  { title: "المسجد والصلاة", icon: "mosque", ids: [...range(12, 26), 32, 33] },
  { title: "الطهارة واللباس والبيت", icon: "home", ids: range(2, 11) },
  { title: "الهم والكرب والشدائد", icon: "relief", ids: [...range(34, 46), 53, 106, ...range(122, 126), 128] },
  { title: "المرض والموت والعزاء", icon: "illness", ids: [...range(49, 52), ...range(54, 60)] },
  { title: "الطعام والصيام", icon: "food", ids: range(68, 76) },
  { title: "المطر والريح والهلال", icon: "rain", ids: [...range(61, 67), 110, 111] },
  { title: "السفر", icon: "travel", ids: range(95, 105) },
  { title: "الحج والعمرة", icon: "hajj", ids: range(115, 121) },
  { title: "الأسرة والناس والآداب", icon: "people", ids: [47, 48, ...range(77, 94), 108, 109, ...range(112, 114), 127, 132] },
];

/** The azkar to suggest at this local hour (none around midday). */
export function timeSuggestion(hour: number): { slug: string; label: string } | null {
  if (hour >= 3 && hour < 12) return { slug: "morning", label: "وقت أذكار الصباح" };
  if (hour >= 15 && hour < 20) return { slug: "evening", label: "وقت أذكار المساء" };
  if (hour >= 20 || hour < 3) return { slug: "sleep", label: "أذكار النوم قبل أن تنام" };
  return null;
}
