/** A hadith book's chapters (its «كتب» or «أبواب»), as the site's /sunnah/[book]. */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { toArabicDigits } from "@lib/content/arabic";
import { Screen } from "@/components/screen";
import { Loading, Unavailable } from "@/components/sunnah-ui";
import { Card, ListRow, T } from "@/components/ui";
import { sunnahBook, type BookDetail, type Failure } from "@/core/sunnah";

export default function SunnahBook() {
  const { book } = useLocalSearchParams<{ book: string }>();
  const [data, setData] = useState<BookDetail | Failure | null>(null);
  useEffect(() => {
    void sunnahBook(book).then((r) => setData(r));
  }, [book]);

  if (data === null) return <Screen back title="السنة"><Loading /></Screen>;
  if (typeof data === "string") return <Screen back title="السنة"><Unavailable why={data} /></Screen>;
  return (
    <Screen back title={data.short}>
      <Card style={{ gap: 4 }}>
        <T weight="bold">{data.title}</T>
        <T size={13} color="mutedForeground">
          {data.author} · {toArabicDigits(data.count)} حديث
        </T>
        <T size={13} color="mutedForeground">
          {data.about}
        </T>
      </Card>
      <Card padded={false} style={{ overflow: "hidden" }}>
        {data.chapters.map((c, i) => (
          <ListRow
            key={c.n}
            title={`${toArabicDigits(c.n)}. ${c.title}`}
            note={`${toArabicDigits(c.count)} حديث`}
            onPress={() => router.push({ pathname: "/sunnah/[book]/chapter/[n]", params: { book, n: String(c.n) } })}
            last={i === data.chapters.length - 1}
          />
        ))}
      </Card>
    </Screen>
  );
}
