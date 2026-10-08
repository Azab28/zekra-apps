/**
 * Ayah-by-ayah recitations (everyayah.com: one MP3 per ayah and reciter) and
 * word pronunciations (quran.com's audio CDN), for the website's mushaf and
 * ayah panel and the bot's tafsir view. Client-safe: no data files.
 */

/** Ayat in each surah (Tanzil / Hafs), surah 1 first. */
export const AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88,
  69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24,
  13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
  15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];
export const AYAH_TOTAL = 6236;

const STARTS = AYAH_COUNTS.reduce<number[]>((acc, _, i) => [...acc, i ? acc[i - 1] + AYAH_COUNTS[i - 1] : 0], []);

/** Index into data/quran.json's ayahs (0-based) of surah:ayah. */
export const ayahIndexOf = (surah: number, ayah: number) => STARTS[surah - 1] + ayah - 1;

/** surah:ayah of an index. */
export function ayahAt(index: number): { surah: number; ayah: number } {
  let surah = 1;
  while (surah < 114 && STARTS[surah] <= index) surah++;
  return { surah, ayah: index - STARTS[surah - 1] + 1 };
}

export type AyahReciter = { id: string; name: string };

/** everyayah.com folders, checked to exist for every ayah. */
export const AYAH_RECITERS: AyahReciter[] = [
  { id: "Alafasy_128kbps", name: "مشاري العفاسي" },
  { id: "Husary_128kbps", name: "محمود خليل الحصري" },
  { id: "Husary_Muallim_128kbps", name: "الحصري (المعلّم)" },
  { id: "Minshawy_Murattal_128kbps", name: "محمد صديق المنشاوي" },
  { id: "Abdul_Basit_Murattal_192kbps", name: "عبد الباسط عبد الصمد" },
  { id: "MaherAlMuaiqly128kbps", name: "ماهر المعيقلي" },
  { id: "Abdurrahmaan_As-Sudais_192kbps", name: "عبد الرحمن السديس" },
  { id: "Saood_ash-Shuraym_128kbps", name: "سعود الشريم" },
  { id: "Yasser_Ad-Dussary_128kbps", name: "ياسر الدوسري" },
  { id: "Abu_Bakr_Ash-Shaatree_128kbps", name: "أبو بكر الشاطري" },
  { id: "Nasser_Alqatami_128kbps", name: "ناصر القطامي" },
  { id: "Ghamadi_40kbps", name: "سعد الغامدي" },
];
export const DEFAULT_AYAH_RECITER = AYAH_RECITERS[0].id;

export const ayahReciter = (id: string | null | undefined): AyahReciter =>
  AYAH_RECITERS.find((r) => r.id === id) ?? AYAH_RECITERS[0];

const pad = (n: number) => String(n).padStart(3, "0");

export const ayahAudioUrl = (reciter: string, surah: number, ayah: number) =>
  `https://everyayah.com/data/${ayahReciter(reciter).id}/${pad(surah)}${pad(ayah)}.mp3`;

/** The basmala recited before a surah (everyayah keeps it as Al-Fatiha's first ayah). */
export const basmalaAudioUrl = (reciter: string) => ayahAudioUrl(reciter, 1, 1);

/** One word said on its own; `position` counts the ayah's words from 1 (pause marks don't count: the files skip none). */
export const wordAudioUrl = (surah: number, ayah: number, position: number) =>
  `https://audio.qurancdn.com/wbw/${pad(surah)}_${pad(ayah)}_${pad(position)}.mp3`;
