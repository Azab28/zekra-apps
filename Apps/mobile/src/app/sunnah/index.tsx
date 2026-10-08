/** «السنة», as the site's /sunnah: the nine books, the hadith of the day, a search box, and «بدون تشكيل». */
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { HadithCard } from "@/components/hadith";
import { ChevronLeft, Search } from "@/components/icons";
import { Screen } from "@/components/screen";
import { bookName, Loading, Unavailable, useSunnahHome } from "@/components/sunnah-ui";
import { Card, ListRow, Row, SectionTitle, SwitchRow, T } from "@/components/ui";
import { useStore } from "@/core/store";
import { START } from "@/theme/rtl";
import { useTheme } from "@/theme/theme";

export default function Sunnah() {
  const { colors } = useTheme();
  const { settings, updateSettings } = useStore();
  const home = useSunnahHome();
  const [q, setQ] = useState("");
  const search = () => q.trim().length >= 2 && router.push({ pathname: "/sunnah/search", params: { q: q.trim() } });

  return (
    <Screen back title="السنة">
      <Row style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 12 }}>
        <Search size={18} color={colors.mutedForeground} />
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={search}
          returnKeyType="search"
          placeholder="ابحث في الأحاديث"
          placeholderTextColor={colors.mutedForeground}
          style={{ flex: 1, height: 46, color: colors.foreground, fontFamily: "Plex-Regular", fontSize: 15, textAlign: START, writingDirection: "rtl" }}
        />
      </Row>
      <Card padded={false} style={{ overflow: "hidden" }}>
        <SwitchRow title="بدون تشكيل" note="نص الأحاديث بلا حركات" value={settings.hadithPlain} onChange={(hadithPlain) => updateSettings((s) => ({ ...s, hadithPlain }))} last />
      </Card>
      {home === null ? (
        <Loading />
      ) : typeof home === "string" ? (
        <Unavailable why={home} />
      ) : (
        <>
          {home.today ? (
            <>
              <SectionTitle>حديث اليوم</SectionTitle>
              <HadithCard hadith={home.today} bookName={bookName(home.books, home.today.book)} showBook />
            </>
          ) : null}
          <SectionTitle>الكتب</SectionTitle>
          <Card padded={false} style={{ overflow: "hidden" }}>
            {home.books.map((b, i) => (
              <ListRow
                key={b.id}
                title={b.title}
                note={`${b.about} · ${toArabicDigits(b.count)} حديث`}
                onPress={() => router.push({ pathname: "/sunnah/[book]", params: { book: b.id } })}
                last={i === home.books.length - 1}
              />
            ))}
          </Card>
          <Pressable onPress={() => router.push({ pathname: "/sunnah/search", params: { q: "" } })} accessibilityRole="link">
            <Row gap={4}>
              <T size={13} color="primary">
                البحث المتقدّم
              </T>
              <ChevronLeft size={14} color={colors.primary} />
            </Row>
          </Pressable>
          <View />
        </>
      )}
    </Screen>
  );
}
