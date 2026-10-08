/** Search the hadiths (the site's /sunnah/search: the letter skeleton, in one book or all), 20 a page. */
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, TextInput } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { HadithCard } from "@/components/hadith";
import { Search } from "@/components/icons";
import { Screen } from "@/components/screen";
import { bookName, Loading, Pager, SortBar, Unavailable, useSunnahHome } from "@/components/sunnah-ui";
import { Row, T } from "@/components/ui";
import { sunnahSearch, type Hadith, type Page, type Sort, type Failure, SEARCH_PAGES } from "@/core/sunnah";
import { START } from "@/theme/rtl";
import { useTheme } from "@/theme/theme";

export default function SunnahSearch() {
  const params = useLocalSearchParams<{ q?: string }>();
  const { colors } = useTheme();
  const home = useSunnahHome();
  const books = home && typeof home === "object" ? home.books : [];
  const [text, setText] = useState(params.q ?? "");
  const [q, setQ] = useState(params.q ?? "");
  const [book, setBook] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<Sort>("order");
  const [data, setData] = useState<Page<Hadith> | Failure | null | "idle">("idle");

  useEffect(() => {
    if (q.trim().length < 2) return setData("idle");
    setData(null);
    void sunnahSearch(q.trim(), book, page, sort).then((r) => setData(r));
  }, [q, book, page, sort]);

  return (
    <Screen back title="البحث في السنة">
      <Row style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 12 }}>
        <Search size={18} color={colors.mutedForeground} />
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => {
            setQ(text);
            setPage(1);
          }}
          returnKeyType="search"
          autoFocus={!params.q}
          placeholder="كلمة أو أكثر من الحديث"
          placeholderTextColor={colors.mutedForeground}
          style={{ flex: 1, height: 46, color: colors.foreground, fontFamily: "Plex-Regular", fontSize: 15, textAlign: START, writingDirection: "rtl" }}
        />
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {[null, ...books.map((b) => b.id)].map((id) => {
          const on = book === id;
          return (
            <Pressable
              key={id ?? "all"}
              onPress={() => {
                setBook(id);
                setPage(1);
              }}
              accessibilityRole="button"
              style={{ borderRadius: 999, borderWidth: 1, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card, paddingHorizontal: 12, paddingVertical: 4 }}
            >
              <T size={12} color={on ? "primaryForeground" : "foreground"}>
                {id ? bookName(books, id) : "كل الكتب"}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
      <SortBar value={sort} onChange={(s) => { setSort(s); setPage(1); }} />
      {data === "idle" ? null : data === null ? (
        <Loading />
      ) : typeof data === "string" ? (
        <Unavailable why={data} />
      ) : (
        <>
          <T size={13} color="mutedForeground">
            {data.total
              ? `${toArabicDigits(data.total)} نتيجة${data.total > SEARCH_PAGES * 20 ? `، تظهر منها أول ${toArabicDigits(SEARCH_PAGES)} صفحة؛ زِد كلمة أو اختر كتابًا لتضييق البحث` : ""}`
              : "لا نتائج. جرّب كلمة أخرى."}
          </T>
          {data.items.map((h) => (
            <HadithCard key={`${h.book}:${h.number}`} hadith={h} bookName={bookName(books, h.book)} showBook clamp />
          ))}
          <Pager page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
    </Screen>
  );
}
