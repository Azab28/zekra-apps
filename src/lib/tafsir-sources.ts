/**
 * The tafsirs the website offers beside التفسير الميسر (data/tafsir-muyassar.json):
 * downloaded by `bun run content:tafsir` into data/tafsir/<id>/<surah>.json
 * (scripts/fetch-tafsir.ts). Client-safe; the files are read by
 * src/lib/tafsir-books.ts.
 */
export type TafsirSource = { id: string; slug: string; name: string; author: string };
/** One passage of a tafsir and the ayat it explains: [fromAyah, toAyah, text]. */
export type TafsirPassage = [number, number, string];

export const TAFSIR_SOURCES: TafsirSource[] = [
  { id: "saadi", slug: "ar-tafsir-as-saadi", name: "تفسير السعدي", author: "عبد الرحمن بن ناصر السعدي" },
  { id: "ibn-kathir", slug: "ar-tafsir-ibn-kathir", name: "تفسير ابن كثير", author: "الحافظ ابن كثير" },
  { id: "baghawi", slug: "ar-tafsir-al-baghawi", name: "تفسير البغوي", author: "الحسين بن مسعود البغوي" },
  { id: "qurtubi", slug: "ar-tafseer-al-qurtubi", name: "تفسير القرطبي", author: "أبو عبد الله القرطبي" },
  { id: "tabari", slug: "ar-tafsir-al-tabari", name: "تفسير الطبري", author: "ابن جرير الطبري" },
];

export const tafsirSource = (id: string) => TAFSIR_SOURCES.find((t) => t.id === id);
