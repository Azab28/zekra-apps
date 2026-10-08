/**
 * Hadith gradings as data/hadith gives them (hadith-api, in English) shown in
 * Arabic: the terms of hadith science and the scholars' names, word for word.
 * A grading the table doesn't fully cover is shown as the source wrote it.
 * Client-safe.
 */

const SCHOLARS: Record<string, string> = {
  "Al-Albani": "الألباني",
  "Shuaib Al Arnaut": "شعيب الأرناؤوط",
  "Zubair Ali Zai": "زبير علي زئي",
  "Muhammad Muhyi Al-Din Abdul Hamid": "محمد محيي الدين عبد الحميد",
  "Ahmad Muhammad Shakir": "أحمد محمد شاكر",
  "Bashar Awad Maarouf": "بشار عواد معروف",
  "Abu Ghuddah": "عبد الفتاح أبو غدة",
  "Muhammad Fouad Abd al-Baqi": "محمد فؤاد عبد الباقي",
  "Salim al-Hilali": "سليم الهلالي",
};

export const scholarName = (name: string) => (Object.hasOwn(SCHOLARS, name) ? SCHOLARS[name] : name);

/** Longest phrases first; each matched as whole words, case-insensitive. */
const TERMS: [RegExp, string][] = (
  [
    ["Sahih - Agreed Upon", "صحيح متفق عليه"],
    ["Sahih - Bukhari And Muslim", "صحيح، رواه البخاري ومسلم"],
    ["Isnaad Sahih Agreed Upon", "إسناده صحيح، متفق عليه"],
    ["Agreed Upon", "متفق عليه"],
    ["Sahih Bukhari", "صحيح البخاري"],
    ["Sahih Muslim", "صحيح مسلم"],
    ["Very Daif Isnaad", "إسناده ضعيف جدًا"],
    ["Isnaad Very Daif", "إسناده ضعيف جدًا"],
    ["Very Daif", "ضعيف جدًا"],
    ["Hasan Sahih Isnaad", "إسناده حسن صحيح"],
    ["Hasan Sahih", "حسن صحيح"],
    ["Sahih Lighairihi", "صحيح لغيره"],
    ["Hasan Lighairihi", "حسن لغيره"],
    ["Daif Lighairihi", "ضعيف لغيره"],
    ["Isnaad Sahih", "إسناده صحيح"],
    ["Sahih Isnaad", "إسناده صحيح"],
    ["Isnaad Hasan", "إسناده حسن"],
    ["Hasan Isnaad", "إسناده حسن"],
    ["Isnaad Daif", "إسناده ضعيف"],
    ["Daif Isnaad", "إسناده ضعيف"],
    ["Sanad Daif", "إسناده ضعيف"],
    ["Sanad Sahih", "إسناده صحيح"],
    ["Sanad Hasan", "إسناده حسن"],
    ["Sahih Hadith", "حديث صحيح"],
    ["Sahih Matn", "صحيح المتن"],
    ["Mauquf", "موقوف"],
    ["Muquf", "موقوف"],
    ["Mawquf", "موقوف"],
    ["Maqtu", "مقطوع"],
    ["Mursal", "مرسل"],
    ["Isnaad Malool", "إسناده معلول"],
    ["Mukhtasar", "مختصرًا"],
    ["After", "بعد"],
    ["Mawdu", "موضوع"],
    ["Maudu", "موضوع"],
    ["Munkar", "منكر"],
    ["Shadh", "شاذ"],
    ["Batil", "باطل"],
    ["Mutawatir", "متواتر"],
    ["Muallaq", "معلق"],
    ["Mudtarib", "مضطرب"],
    ["Sahih", "صحيح"],
    ["Hasan", "حسن"],
    ["Daif", "ضعيف"],
    ["Da'if", "ضعيف"],
    ["And", "و"],
  ] as const
).map(([en, ar]) => [new RegExp(`(?<![A-Za-z'])${en.replace(/[-']/g, (c) => `\\${c}`).replace(/ /g, "\\s+")}(?![A-Za-z'])`, "gi"), ar]);

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** «Hasan Sahih» → «حسن صحيح»; `whole` is false when some of it had no Arabic term (then `text` is the original). */
export function gradeInArabic(grade: string): { text: string; whole: boolean } {
  let out = grade;
  for (const [re, ar] of TERMS) out = out.replace(re, ar);
  if (/[A-Za-z]/.test(out)) return { text: grade, whole: false };
  const text = out
    .replace(/\d/g, (d) => ARABIC_DIGITS[+d])
    .replace(/\s*-\s*/g, " – ")
    .replace(/\s+/g, " ")
    .trim();
  return { text, whole: true };
}

export type GradeKind = "sahih" | "hasan" | "daif" | "mawdu" | "other";

/** Which colour a grading gets: fabricated, weak, sound-by-support (hasan) or sound. */
export function gradeKind(grade: string): GradeKind {
  const g = grade.toLowerCase();
  if (/mawdu|maudu|batil/.test(g)) return "mawdu";
  if (/da'?if|munkar|shadh|mudtarib/.test(g)) return "daif";
  if (/sahih/.test(g)) return "sahih";
  if (/hasan/.test(g)) return "hasan";
  return "other";
}

export const GRADE_KIND_LABEL: Record<GradeKind, string> = {
  sahih: "صحيح",
  hasan: "حسن",
  daif: "ضعيف",
  mawdu: "موضوع",
  other: "",
};

/** The two Sahihs carry no gradings in the source: their hadiths are sahih by the book itself. */
export const SAHIH_BOOKS: readonly string[] = ["bukhari", "muslim"];

/**
 * The grading to show first: al-Albani's if he graded it, else the first one
 * given; for Bukhari and Muslim, the book's own.
 */
export function mainGrade(book: string, grades: [string, string][]): { kind: GradeKind; by: string | null; grade: string | null } {
  if (SAHIH_BOOKS.includes(book)) return { kind: "sahih", by: null, grade: null };
  const g = grades.find(([s]) => s === "Al-Albani") ?? grades[0];
  if (!g) return { kind: "other", by: null, grade: null };
  return { kind: gradeKind(g[1]), by: g[0], grade: g[1] };
}
