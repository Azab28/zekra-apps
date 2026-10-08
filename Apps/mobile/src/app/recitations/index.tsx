/** Reciters from mp3quran.net (data/reciters.json), as the site's /recitations. */
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { reciters } from "@lib/content/data";
import { toArabicDigits } from "@lib/content/arabic";
import { foldArabic } from "@lib/fold-arabic";
import { ChevronLeft, ChevronRight, HardDriveDownload, Headphones, Search } from "@/components/icons";
import { SceneBackground } from "@/components/scene";
import { IconButton, Row, T } from "@/components/ui";
import { useMiniPlayerSpace } from "@/components/layout-metrics";
import { START } from "@/theme/rtl";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;

export default function Recitations() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const mini = useMiniPlayerSpace();
  const [query, setQuery] = useState("");
  const all = useMemo(() => reciters().filter((r) => r.moshaf.length > 0), []);
  const q = foldArabic(query);
  const list = q ? all.filter((r) => foldArabic(r.name).includes(q)) : all;

  return (
    <View style={{ flex: 1, direction: "rtl" }}>
      <SceneBackground kind="quiet" />
      <FlatList
        data={list}
        keyExtractor={(r) => String(r.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + mini + 16 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <Row>
              <IconButton icon={ChevronRight} label="رجوع" onPress={() => (router.canGoBack() ? router.back() : router.replace("/more"))} />
              <T size={22} weight="bold" style={{ flex: 1 }}>
                التلاوات
              </T>
              <IconButton icon={Headphones} label="الاستماع: المقترح والمفضّلة والورد" onPress={() => router.push("/listen")} />
              <IconButton icon={HardDriveDownload} label="التنزيلات" onPress={() => router.push("/downloads")} />
            </Row>
            <T color="mutedForeground">سور القرآن كاملة بأصوات {n(all.length)} قارئًا من mp3quran.net، وتستمر في الخلفية. حمّل ما تريد لتسمعه بلا إنترنت.</T>
            <Row style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 12 }}>
              <Search size={18} color={colors.mutedForeground} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="ابحث عن قارئ"
                placeholderTextColor={colors.mutedForeground}
                style={{ flex: 1, height: 46, color: colors.foreground, fontFamily: "Plex-Regular", fontSize: 15, textAlign: START, writingDirection: "rtl" }}
              />
            </Row>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/recitations/[id]", params: { id: String(item.id) } })}
            accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.muted : colors.card })}
          >
            <View style={{ flex: 1 }}>
              <T weight="semibold">{item.name}</T>
              <T size={12} color="mutedForeground" lines={1}>
                {item.moshaf.length > 1 ? `${n(item.moshaf.length)} روايات` : item.moshaf[0].name}
              </T>
            </View>
            <ChevronLeft size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
        ListEmptyComponent={
          <T color="mutedForeground" align="center">
            لا يوجد قارئ بهذا الاسم.
          </T>
        }
      />
    </View>
  );
}
