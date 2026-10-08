/**
 * «السنة» from the site (the books are ~30 MB with their explanations, too
 * big to carry): the app API /api/app/sunnah/* (see the server spec in
 * Apps/mobile/SERVER-SPEC.md), read-only and cacheable. Text, numbers and
 * gradings are only what data/hadith holds; gradings are put in Arabic here
 * with src/lib/hadith-grades.ts, as the site does.
 */
import { SITE_URL } from "./site";

export type Hadith = { book: string; number: string; chapter: number; text: string; grades: [string, string][] };
export type Chapter = { n: number; title: string; count: number };
export type Book = { id: string; short: string; title: string; author: string; about: string; count: number; chapters: number };
export type BookDetail = Omit<Book, "chapters"> & { chapters: Chapter[] };
export type Sharh = { id: string; title: string; explanation: string; lessons: string[]; words: [string, string][]; url: string };
export type Page<T> = { page: number; pages: number; total: number; items: T[] };
export const SORTS = { order: "ترتيب الكتاب", grade: "الأصح أولًا", short: "الأقصر أولًا", long: "الأطول أولًا" } as const;
export type Sort = keyof typeof SORTS;

/** Why a page didn't come: the site not reached, no such book/hadith (404), too many requests (429: search is 20 a minute), or the books not there right now (503, anything else). */
export type Failure = "offline" | "missing" | "limited" | "down";

async function get<T>(path: string): Promise<T | Failure> {
  let res: Response;
  try {
    res = await fetch(`${SITE_URL}/api/app/sunnah${path}`, { headers: { Accept: "application/json" } });
  } catch {
    return "offline";
  }
  if (res.status === 404) return "missing";
  if (res.status === 429) return "limited";
  if (!res.ok) return "down";
  return ((await res.json().catch(() => null)) as T | null) ?? "down";
}

export const sunnahHome = () => get<{ books: Book[]; today: Hadith | null }>("");
export const sunnahBook = (book: string) => get<BookDetail>(`/${book}`);
export const sunnahChapter = (book: string, n: number, page: number, sort: Sort) =>
  get<{ chapter: Chapter } & Page<Hadith>>(`/${book}/chapter/${n}?page=${page}&sort=${sort}`);
export const sunnahHadith = (book: string, number: string) =>
  get<{ hadith: Hadith; chapter: Chapter | null; prev: string | null; next: string | null; sharh: Sharh | null }>(`/${book}/${encodeURIComponent(number)}`);
export const sunnahSearch = (q: string, book: string | null, page: number, sort: Sort) =>
  get<Page<Hadith>>(`/search?${new URLSearchParams({ q, page: String(page), sort, ...(book ? { book } : {}) })}`);

/** Search reaches 25 pages at most (the site's MAX_SEARCH_PAGES), though `total` counts every match. */
export const SEARCH_PAGES = 25;

/** «٣٤٥٦» or «٣٤٥٦٫١» for the sub-numbers the books use. */
export const hadithNumber = (s: string) => s.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]).replace(".", "٫");
