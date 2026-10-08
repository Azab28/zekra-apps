/** Live Quran stations (data/radios.json, mp3quran.net), as the site's /radio: reciters' stations and programmes, with what's playing now. */
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, SectionList, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radioStations } from "@lib/content/data";
import { foldArabic } from "@lib/fold-arabic";
import { ChevronRight, Pause, Radio as RadioIcon, Search, Star } from "@/components/icons";
import { useMiniPlayerSpace } from "@/components/layout-metrics";
import { SceneBackground } from "@/components/scene";
import { IconButton, Row, SectionTitle, T } from "@/components/ui";
import { usePlayer } from "@/core/player";
import { useStore } from "@/core/store";
import { START } from "@/theme/rtl";
import { useTheme } from "@/theme/theme";

export default function Radio() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const mini = useMiniPlayerSpace();
  const player = usePlayer();
  const { settings, updateSettings } = useStore();
  const favs = settings.listen.favStations;
  const [query, setQuery] = useState("");
  const all = useMemo(radioStations, []);
  const q = foldArabic(query);
  const list = q ? all.filter((s) => foldArabic(s.name).includes(q)) : all;
  const sections = [
    { title: "البرامج والإذاعات", data: list.filter((s) => s.group === "program") },
    { title: "القرّاء", data: list.filter((s) => s.group === "reciter") },
  ].filter((s) => s.data.length);
  const currentId = player.track?.kind === "radio" ? player.track.id : null;
  const playing = player.status.playing || player.status.buffering;

  return (
    <View style={{ flex: 1, direction: "rtl" }}>
      <SceneBackground kind="quiet" />
      <SectionList
        sections={sections}
        keyExtractor={(s) => String(s.id)}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + mini + 16 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <Row>
              <IconButton icon={ChevronRight} label="رجوع" onPress={() => (router.canGoBack() ? router.back() : router.replace("/more"))} />
              <T size={22} weight="bold" style={{ flex: 1 }}>
                الإذاعات
              </T>
            </Row>
            <Row style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 12 }}>
              <Search size={18} color={colors.mutedForeground} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="ابحث عن إذاعة أو قارئ"
                placeholderTextColor={colors.mutedForeground}
                style={{ flex: 1, height: 46, color: colors.foreground, fontFamily: "Plex-Regular", fontSize: 15, textAlign: START, writingDirection: "rtl" }}
              />
            </Row>
          </View>
        }
        renderSectionHeader={({ section }) => <SectionTitle>{section.title}</SectionTitle>}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => {
          const on = currentId === item.id;
          return (
            <Pressable
              onPress={() => (on ? player.toggle() : player.play({ kind: "radio", id: item.id, name: item.name, url: item.url }))}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 14,
                borderRadius: 16,
                borderWidth: on ? 2 : 1,
                borderColor: on ? colors.primary : colors.border,
                backgroundColor: pressed ? colors.muted : colors.card,
              })}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
                {on && playing ? <Pause size={18} color={colors.primary} /> : <RadioIcon size={18} color={colors.primary} />}
              </View>
              <View style={{ flex: 1 }}>
                <T weight={on ? "bold" : "medium"} color={on ? "primary" : "foreground"}>
                  {item.name}
                </T>
                {on && player.live ? (
                  <T size={12} color="mutedForeground" lines={1}>
                    يُتلى الآن: {player.live}
                  </T>
                ) : null}
              </View>
              <IconButton
                icon={Star}
                label={favs.includes(item.id) ? "إزالة من المفضّلة" : "إضافة إلى المفضّلة"}
                size={34}
                tone={favs.includes(item.id) ? "primary" : "plain"}
                onPress={() =>
                  updateSettings((s) => ({
                    ...s,
                    listen: { ...s.listen, favStations: favs.includes(item.id) ? s.listen.favStations.filter((x) => x !== item.id) : [...s.listen.favStations, item.id] },
                  }))
                }
              />
            </Pressable>
          );
        }}
      />
    </View>
  );
}
