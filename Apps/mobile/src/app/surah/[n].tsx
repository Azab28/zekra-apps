/**
 * A surah as continuous text (Tanzil Uthmani, data/quran.json), as the site's
 * /surah/[n]: «استمع للسورة» ayah by ayah with the recited ayah highlighted and
 * kept in view, and an ayah's panel on a tap (its tafsir, listening, images…).
 * The text goes in paragraphs of a few ayat, so a long surah scrolls smoothly
 * and an ayah can be scrolled to.
 */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ayahReciter } from "@lib/ayah-audio";
import { toArabicDigits } from "@lib/content/arabic";
import { quran } from "@lib/content/data";
import { AyahPanel } from "@/components/ayah-panel";
import { BookOpen, ChevronLeft, ChevronRight, Pause, Play } from "@/components/icons";
import { useMiniPlayerSpace } from "@/components/layout-metrics";
import { SceneBackground } from "@/components/scene";
import { IconButton, Row, T } from "@/components/ui";
import { ayahLoop, useAyahOnAir, usePlayer } from "@/core/player";
import { ayahAt, surahs } from "@/core/quran";
import { useStore } from "@/core/store";
import { alpha, css } from "@/theme/colors";
import { QURAN_FONT } from "@/theme/fonts";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;
const PER_PARAGRAPH = 8;

export default function SurahScreen() {
  const params = useLocalSearchParams<{ n: string; ayah?: string }>();
  const insets = useSafeAreaInsets();
  const mini = useMiniPlayerSpace();
  const { colors, raw, scale } = useTheme();
  const { settings } = useStore();
  const player = usePlayer();
  const onAir = useAyahOnAir();
  const list = useRef<FlatList<number[]>>(null);
  const num = Math.min(Math.max(Number(params.n) || 1, 1), 114);
  const s = surahs()[num - 1];
  const [selected, setSelected] = useState<number | null>(null);

  const ayat = useMemo(() => Array.from({ length: s.ayahCount }, (_, i) => s.start + i), [s]);
  const paragraphs = useMemo(() => {
    const out: number[][] = [];
    for (let i = 0; i < ayat.length; i += PER_PARAGRAPH) out.push(ayat.slice(i, i + PER_PARAGRAPH));
    return out;
  }, [ayat]);
  const first = ayat[0];
  const last = ayat[ayat.length - 1];
  const inSurah = player.track?.kind === "ayah" && onAir != null && onAir >= first && onAir <= last;
  const playing = player.status.playing || player.status.buffering;
  const size = Math.round(24 * scale);

  const scrollTo = (index: number) => {
    const p = Math.floor((index - first) / PER_PARAGRAPH);
    if (p >= 0 && p < paragraphs.length) list.current?.scrollToIndex({ index: p, viewPosition: 0.3, animated: true });
  };

  // Opened at an ayah (from search or the mushaf): there, with its panel.
  useEffect(() => {
    const a = Number(params.ayah);
    if (!a || a < 1 || a > s.ayahCount) return;
    const t = setTimeout(() => scrollTo(first + a - 1), 300);
    return () => clearTimeout(t);
  }, [params.ayah, num]);

  // Keep the ayah being recited in view.
  useEffect(() => {
    if (onAir != null && onAir >= first && onAir <= last) scrollTo(onAir);
  }, [onAir]);

  const listen = () => {
    if (inSurah) return player.toggle();
    player.play(ayahLoop(settings.reciter, first, last, 1));
  };

  const go = (to: number) => router.replace({ pathname: "/surah/[n]", params: { n: String(to) } });

  const header = (
    <View style={{ gap: 12, marginBottom: 8 }}>
      <Row>
        <IconButton icon={ChevronRight} label="رجوع" onPress={() => (router.canGoBack() ? router.back() : router.replace("/quran"))} />
        <View style={{ flex: 1 }}>
          <T size={20} weight="bold" lines={1}>
            سورة {s.name}
          </T>
          <T size={12} color="mutedForeground">
            {s.medinan ? "مدنية" : "مكية"} · {n(s.ayahCount)} آية · تبدأ في الصفحة {n(s.page)}
          </T>
        </View>
        <IconButton icon={BookOpen} label="في المصحف" onPress={() => router.push({ pathname: "/mushaf/[page]", params: { page: String(s.page) } })} />
      </Row>
      <Row style={{ justifyContent: "center", flexWrap: "wrap" }}>
        <Pressable
          onPress={listen}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, height: 38, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 })}
        >
          {inSurah && playing ? <Pause size={16} color={colors.primaryForeground} /> : <Play size={16} color={colors.primaryForeground} />}
          <T size={14} weight="medium" color="primaryForeground">
            {inSurah ? (playing ? "إيقاف مؤقت" : "متابعة") : "استمع للسورة"}
          </T>
        </Pressable>
        <T size={12} color="mutedForeground">
          {ayahReciter(settings.reciter).name}
        </T>
      </Row>
      {num !== 1 && num !== 9 ? (
        <Text style={{ fontFamily: QURAN_FONT, fontSize: size, lineHeight: size * 2.1, textAlign: "center", color: colors.foreground }}>{quran().basmala}</Text>
      ) : null}
    </View>
  );

  const footer = (
    <Row style={{ justifyContent: "space-between", marginTop: 16 }}>
      {num > 1 ? (
        <Pressable onPress={() => go(num - 1)} accessibilityRole="button">
          <Row gap={4}>
            <ChevronRight size={16} color={colors.primary} />
            <T size={14} color="primary">
              سورة {surahs()[num - 2].name}
            </T>
          </Row>
        </Pressable>
      ) : (
        <View />
      )}
      {num < 114 ? (
        <Pressable onPress={() => go(num + 1)} accessibilityRole="button">
          <Row gap={4}>
            <T size={14} color="primary">
              سورة {surahs()[num].name}
            </T>
            <ChevronLeft size={16} color={colors.primary} />
          </Row>
        </Pressable>
      ) : (
        <View />
      )}
    </Row>
  );

  return (
    <View style={{ flex: 1, direction: "rtl" }}>
      <SceneBackground kind="quiet" />
      <FlatList
        ref={list}
        data={paragraphs}
        keyExtractor={(p) => String(p[0])}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + mini + 24 }}
        onScrollToIndexFailed={(e) => {
          list.current?.scrollToOffset({ offset: e.averageItemLength * e.index, animated: false });
          setTimeout(() => list.current?.scrollToIndex({ index: e.index, viewPosition: 0.3, animated: true }), 120);
        }}
        renderItem={({ item }) => (
          <Text style={{ fontFamily: QURAN_FONT, fontSize: size, lineHeight: size * 2.25, color: colors.foreground, textAlign: "justify", writingDirection: "rtl" }}>
            {item.map((index) => {
              const a = ayahAt(index);
              const bg = selected === index ? css(alpha(raw.primary, 0.15)) : onAir === index ? css(alpha(raw.gold, 0.25)) : undefined;
              return (
                <Text key={index} onPress={() => setSelected(index)} style={bg ? { backgroundColor: bg } : undefined}>
                  {a.text}
                  <Text style={{ color: colors.primary }}> ﴿{n(a.ayah)}﴾ </Text>
                </Text>
              );
            })}
          </Text>
        )}
      />
      <AyahPanel index={selected} ayat={ayat} onChange={setSelected} from="surah" />
    </View>
  );
}
