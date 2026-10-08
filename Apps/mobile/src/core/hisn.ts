/**
 * Hisn al-Muslim in the app, from data/hisn.json through src/lib/content/data
 * (bundled by src/shims/node-fs.ts): the chapters, and the named sets the
 * site's reader has (src/lib/reader.ts: morning and evening are chapter 27,
 * sleep is 28).
 */
import { chapterById, hisn, type HisnChapter } from "@lib/content/data";
import { HISN_GROUPS } from "@lib/hisn-groups";

export type AzkarItem = { text: string; repeat: number };
export type AzkarSet = { slug: string; title: string; items: AzkarItem[] };

const NAMED: Record<string, { title: string; ids: number[] }> = {
  morning: { title: "أذكار الصباح", ids: [27] },
  evening: { title: "أذكار المساء", ids: [27] },
  sleep: { title: "أذكار النوم", ids: [28] },
};

/** A named set or a chapter id, as the site's /r/<slug>. */
export function azkarSet(slug: string): AzkarSet | null {
  const named = Object.hasOwn(NAMED, slug) ? NAMED[slug] : undefined;
  const ids = named?.ids ?? (/^\d{1,3}$/.test(slug) ? [Number(slug)] : []);
  const chapters = ids.map(chapterById).filter((c): c is HisnChapter => !!c && c.items.length > 0);
  if (!chapters.length) return null;
  return {
    slug,
    title: named?.title ?? chapters.map((c) => c.title).join(" • "),
    items: chapters.flatMap((c) => c.items.map((i) => ({ text: i.text, repeat: Math.max(i.repeat, 1) }))),
  };
}

export type AzkarGroup = (typeof HISN_GROUPS)[number] & { chapters: HisnChapter[] };

/** The index: HISN_GROUPS with each chapter (chapters without azkar left out). */
export function azkarIndex(): AzkarGroup[] {
  const byId = new Map(hisn().chapters.map((c) => [c.id, c]));
  return HISN_GROUPS.map((g) => ({
    ...g,
    chapters: g.ids.map((id) => byId.get(id)).filter((c): c is HisnChapter => !!c && c.items.length > 0),
  }));
}

/** What to read next after finishing a set (as on the site's reader). */
export const AFTER: Record<string, { slug: string; label: string }[]> = {
  morning: [
    { slug: "evening", label: "أذكار المساء (بعد العصر)" },
    { slug: "130", label: "التسبيح والتحميد" },
  ],
  evening: [
    { slug: "sleep", label: "أذكار النوم" },
    { slug: "129", label: "الاستغفار والتوبة" },
  ],
  sleep: [{ slug: "morning", label: "أذكار الصباح (بعد الفجر)" }],
};
