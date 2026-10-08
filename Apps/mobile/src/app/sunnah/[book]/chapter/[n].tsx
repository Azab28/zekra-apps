/** One chapter's hadiths, 20 a page, in the book's order or by grading or length (the site's ?sort=). */
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { HadithCard } from "@/components/hadith";
import { Screen } from "@/components/screen";
import { bookName, Loading, Pager, SortBar, Unavailable, useSunnahHome } from "@/components/sunnah-ui";
import { T } from "@/components/ui";
import { sunnahChapter, type Chapter, type Hadith, type Page, type Sort, type Failure } from "@/core/sunnah";

export default function SunnahChapter() {
  const { book, n } = useLocalSearchParams<{ book: string; n: string }>();
  const home = useSunnahHome();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<Sort>("order");
  const [data, setData] = useState<({ chapter: Chapter } & Page<Hadith>) | Failure | null>(null);
  useEffect(() => {
    setData(null);
    void sunnahChapter(book, Number(n), page, sort).then((r) => setData(r));
  }, [book, n, page, sort]);
  const name = bookName(home && typeof home === "object" ? home.books : undefined, book);

  return (
    <Screen back title={name}>
      {data && typeof data === "object" ? (
        <T weight="bold">{data.chapter.title}</T>
      ) : null}
      <SortBar value={sort} onChange={(s) => { setSort(s); setPage(1); }} />
      {data === null ? (
        <Loading />
      ) : typeof data === "string" ? (
        <Unavailable why={data} />
      ) : (
        <>
          {data.items.map((h) => (
            <HadithCard key={h.number} hadith={h} bookName={name} clamp />
          ))}
          <Pager page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
    </Screen>
  );
}
