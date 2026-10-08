/** The mushaf's front page: carry on reading, today's khatma wird, search, the Quran's duas, and the surah/juz index (pages or text). */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { pageInfo } from "@lib/content/mushaf-pages";
import { BookHeart, BookMarked, BookOpen, ChevronLeft, Search } from "@/components/icons";
import { MushafIndex } from "@/components/mushaf-index";
import { OfflineMushaf } from "@/components/offline-mushaf";
import { Screen } from "@/components/screen";
import { Card, ListRow, Row, T } from "@/components/ui";
import { todayIn } from "@/core/day";
import { lastPage, MUSHAF_PAGES, surahName } from "@/core/quran";
import { useStore } from "@/core/store";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;
const openPage = (page: number) => router.push({ pathname: "/mushaf/[page]", params: { page: String(page) } });

export default function Quran() {
  const { colors } = useTheme();
  const { prefs } = useStore();
  const [last, setLast] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      void lastPage().then(setLast);
    }, []),
  );

  const k = prefs.khatma;
  const wirdDone = k.day === todayIn(prefs.place?.timezone);

  return (
    <Screen tab title="المصحف">
      <Pressable onPress={() => router.push("/search")} accessibilityRole="button" accessibilityLabel="البحث في القرآن">
        <Row style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 14, height: 48 }}>
          <Search size={18} color={colors.mutedForeground} />
          <T color="mutedForeground">ابحث في القرآن الكريم</T>
        </Row>
      </Pressable>

      <Row gap={10} align="stretch">
        <Tile
          icon={BookOpen}
          title={last ? "تابع القراءة" : "ابدأ القراءة"}
          note={last ? `ص ${n(last)} · ${pageInfo(last).surahs.map(surahName).join("، ")}` : "من سورة الفاتحة"}
          onPress={() => openPage(last ?? 1)}
        />
        <Tile
          icon={BookMarked}
          title="ختمتي"
          note={k.page ? (wirdDone ? "أنهيت ورد اليوم" : `وردك: ص ${n(k.page)}–${n(Math.min(k.page + k.daily - 1, MUSHAF_PAGES))}`) : "ابدأ ختمة بورد يومي"}
          onPress={() => router.push("/khatma")}
        />
      </Row>

      <Card padded={false} style={{ overflow: "hidden" }}>
        <ListRow icon={BookHeart} title="أدعية من القرآن" note="«ربنا» وأدعية الأنبياء بنص المصحف" onPress={() => router.push("/quran-duas")} last />
      </Card>

      <Card style={{ gap: 6 }}>
        <T size={12} color="mutedForeground">
          اضغط السورة لفتحها في المصحف، أو أيقونة النص لقراءتها متصلة مع التفسير.
        </T>
        <MushafIndex onGo={openPage} onText={(s) => router.push({ pathname: "/surah/[n]", params: { n: String(s) } })} />
      </Card>

      <OfflineMushaf />
    </Screen>
  );
}

function Tile({ icon: Icon, title, note, onPress }: { icon: typeof BookOpen; title: string; note: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ flex: 1, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.muted : colors.card, padding: 14, gap: 6 })}
    >
      <Row style={{ justifyContent: "space-between" }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
          <Icon size={20} color={colors.primary} />
        </View>
        <ChevronLeft size={16} color={colors.mutedForeground} />
      </Row>
      <T weight="semibold">{title}</T>
      <T size={12} color="mutedForeground" lines={2}>
        {note}
      </T>
    </Pressable>
  );
}
