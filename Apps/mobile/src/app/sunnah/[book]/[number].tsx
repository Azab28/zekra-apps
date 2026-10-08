/** One hadith, as the site's /sunnah/[book]/[number]: text, every scholar's grading, its explanation when the encyclopedia has one, the previous and next, a report. */
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { FeedbackForm } from "@/components/feedback-form";
import { GradesList, HadithCard } from "@/components/hadith";
import { ChevronLeft, ChevronRight, ExternalLink, Flag } from "@/components/icons";
import { Screen } from "@/components/screen";
import { bookName, Loading, Unavailable, useSunnahHome } from "@/components/sunnah-ui";
import { Button, Card, Row, SectionTitle, T } from "@/components/ui";
import { hadithNumber, sunnahHadith, type Chapter, type Hadith, type Sharh, type Failure } from "@/core/sunnah";
import { useTheme } from "@/theme/theme";

type Data = { hadith: Hadith; chapter: Chapter | null; prev: string | null; next: string | null; sharh: Sharh | null };

export default function SunnahHadith() {
  const { book, number } = useLocalSearchParams<{ book: string; number: string }>();
  const { colors } = useTheme();
  const home = useSunnahHome();
  const [data, setData] = useState<Data | Failure | null>(null);
  const [reporting, setReporting] = useState(false);
  useEffect(() => {
    setData(null);
    void sunnahHadith(book, number).then((r) => setData(r));
  }, [book, number]);
  const name = bookName(home && typeof home === "object" ? home.books : undefined, book);
  const go = (to: string) => router.replace({ pathname: "/sunnah/[book]/[number]", params: { book, number: to } });

  return (
    <Screen back title={`${name} — ${hadithNumber(number)}`}>
      {data === null ? (
        <Loading />
      ) : typeof data === "string" ? (
        <Unavailable why={data} />
      ) : (
        <>
          {data.chapter ? (
            <T size={13} color="mutedForeground">
              {data.chapter.title}
            </T>
          ) : null}
          <HadithCard hadith={data.hadith} bookName={name} />
          <SectionTitle>أحكام العلماء</SectionTitle>
          <GradesList book={book} grades={data.hadith.grades} />
          {data.sharh ? (
            <>
              <SectionTitle>شرح الحديث</SectionTitle>
              <Card style={{ gap: 10 }}>
                <T selectable style={{ lineHeight: 28 }}>
                  {data.sharh.explanation}
                </T>
                {data.sharh.lessons.length ? (
                  <View style={{ gap: 4 }}>
                    <T weight="semibold">من فوائد الحديث</T>
                    {data.sharh.lessons.map((l, i) => (
                      <T key={i} size={14} style={{ lineHeight: 26 }}>
                        • {l}
                      </T>
                    ))}
                  </View>
                ) : null}
                {data.sharh.words.length ? (
                  <View style={{ gap: 4 }}>
                    <T weight="semibold">معاني الكلمات</T>
                    {data.sharh.words.map(([w, m], i) => (
                      <T key={i} size={14}>
                        <T size={14} weight="semibold">{w}</T>: {m}
                      </T>
                    ))}
                  </View>
                ) : null}
                <Button label="من موسوعة الأحاديث النبوية" icon={ExternalLink} size="sm" variant="ghost" onPress={() => void WebBrowser.openBrowserAsync(data.sharh!.url)} />
              </Card>
            </>
          ) : null}
          <Row style={{ justifyContent: "space-between" }}>
            <Button label="السابق" icon={ChevronRight} size="sm" variant="outline" disabled={!data.prev} onPress={() => data.prev && go(data.prev)} />
            <Button label="بلّغ عن خطأ" icon={Flag} size="sm" variant="ghost" onPress={() => setReporting((v) => !v)} />
            <Button label="التالي" icon={ChevronLeft} size="sm" variant="outline" disabled={!data.next} onPress={() => data.next && go(data.next)} />
          </Row>
          {reporting ? (
            <Card>
              <FeedbackForm context={{ type: "other", ref: `${book}:${number}`, label: `${name} ${hadithNumber(number)}`, url: `/sunnah/${book}/${number}` }} onDone={() => setReporting(false)} />
            </Card>
          ) : null}
          <View style={{ height: 4, backgroundColor: colors.background }} />
        </>
      )}
    </Screen>
  );
}
