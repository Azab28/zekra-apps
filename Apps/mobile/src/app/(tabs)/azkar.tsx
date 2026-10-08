/** The azkar index as on the site (/r): morning, evening and sleep with today's progress, quick chapters, and Hisn al-Muslim's sections. */
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { foldArabic } from "@lib/fold-arabic";
import { timeSuggestion, type HisnGroupIcon } from "@lib/hisn-groups";
import {
  ChevronDown,
  CloudRain,
  Footprints,
  HandHeart,
  Handshake,
  HeartPulse,
  House,
  Landmark,
  Luggage,
  Moon,
  MoonStar,
  Search,
  Sparkles,
  Sun,
  SunMoon,
  Utensils,
  type LucideIcon,
} from "@/components/icons";
import { Screen } from "@/components/screen";
import { Card, RADIUS, Row, T } from "@/components/ui";
import { azkarIndex, azkarSet, type AzkarGroup } from "@/core/hisn";
import { progressShare } from "@/core/reader-progress";
import { START } from "@/theme/rtl";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;

const GROUP_ICONS: Record<HisnGroupIcon, LucideIcon> = {
  day: SunMoon,
  mosque: Landmark,
  home: House,
  relief: HandHeart,
  illness: HeartPulse,
  food: Utensils,
  rain: CloudRain,
  travel: Luggage,
  hajj: Footprints,
  people: Handshake,
};

/** The site's featured cards: Tailwind amber/orange, indigo/sky and violet/fuchsia washes. */
const FEATURED = [
  { slug: "morning", title: "أذكار الصباح", note: "بعد الفجر", icon: Sun, from: "rgba(251,191,36,0.25)", to: "rgba(249,115,22,0.1)", fg: ["#b45309", "#fcd34d"] },
  { slug: "evening", title: "أذكار المساء", note: "بعد العصر", icon: Moon, from: "rgba(129,140,248,0.25)", to: "rgba(14,165,233,0.1)", fg: ["#4338ca", "#a5b4fc"] },
  { slug: "sleep", title: "أذكار النوم", note: "قبل أن تنام", icon: MoonStar, from: "rgba(167,139,250,0.25)", to: "rgba(217,70,239,0.1)", fg: ["#6d28d9", "#c4b5fd"] },
] as const;

const QUICK = [
  { id: 25, label: "بعد الصلاة" },
  { id: 129, label: "الاستغفار" },
  { id: 130, label: "التسبيح" },
  { id: 35, label: "دعاء الكرب" },
  { id: 1, label: "الاستيقاظ" },
  { id: 96, label: "السفر" },
];

const open = (slug: string | number) => router.push({ pathname: "/azkar/[slug]", params: { slug: String(slug) } });

export default function Azkar() {
  const { colors } = useTheme();
  const groups = useMemo(azkarIndex, []);
  const [query, setQuery] = useState("");
  const [openGroup, setOpenGroup] = useState<string | null>(groups[0]?.title ?? null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const suggestion = timeSuggestion(new Date().getHours());

  // Today's progress, read again whenever the tab comes back into view.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void Promise.all(FEATURED.map(async (f) => [f.slug, await progressShare(f.slug, azkarSet(f.slug)?.items.length ?? 0)] as const)).then((list) => {
        if (alive) setProgress(Object.fromEntries(list));
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const q = foldArabic(query);
  const all = useMemo(() => groups.flatMap((g) => g.chapters), [groups]);
  const matches = q ? all.filter((c) => foldArabic(c.title).includes(q)) : null;

  return (
    <Screen tab title="الأذكار">
      <T color="mutedForeground">أذكار حصن المسلم كاملة، مع العدّاد. يُحفظ تقدّمك على جهازك.</T>
      {suggestion ? (
        <Pressable onPress={() => open(suggestion.slug)} accessibilityRole="button" style={{ alignSelf: "flex-start" }}>
          <Row gap={6} style={{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
            <Sparkles size={15} color={colors.primary} />
            <T size={14} weight="medium" color="primary">
              {suggestion.label}
            </T>
          </Row>
        </Pressable>
      ) : null}

      <Row gap={8} align="stretch">
        {FEATURED.map((f) => (
          <Featured key={f.slug} f={f} share={progress[f.slug] ?? 0} suggested={suggestion?.slug === f.slug} />
        ))}
      </Row>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {QUICK.map((x) => (
          <Pressable
            key={x.id}
            onPress={() => open(x.id)}
            accessibilityRole="button"
            style={({ pressed }) => ({ borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.muted : colors.card, paddingHorizontal: 14, paddingVertical: 6 })}
          >
            <T size={14}>{x.label}</T>
          </Pressable>
        ))}
      </View>

      <Row style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 12 }}>
        <Search size={18} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث في أبواب حصن المسلم: السفر، المطر، الكرب…"
          placeholderTextColor={colors.mutedForeground}
          style={{ flex: 1, height: 46, color: colors.foreground, fontFamily: "Plex-Regular", fontSize: 15, textAlign: START, writingDirection: "rtl" }}
        />
      </Row>

      {matches ? (
        matches.length ? (
          <Card padded={false} style={{ overflow: "hidden" }}>
            {matches.map((c, i) => (
              <ChapterRow key={c.id} id={c.id} title={c.title} count={c.items.length} last={i === matches.length - 1} />
            ))}
          </Card>
        ) : (
          <T color="mutedForeground" align="center" style={{ paddingVertical: 20 }}>
            لا يوجد باب بهذا الاسم.
          </T>
        )
      ) : (
        groups.map((g) => <Group key={g.title} g={g} open={openGroup === g.title} onToggle={() => setOpenGroup(openGroup === g.title ? null : g.title)} />)
      )}
    </Screen>
  );
}

function Featured({ f, share, suggested }: { f: (typeof FEATURED)[number]; share: number; suggested: boolean }) {
  const { colors, dark } = useTheme();
  const fg = f.fg[dark ? 1 : 0];
  return (
    <Pressable onPress={() => open(f.slug)} accessibilityRole="button" accessibilityLabel={f.title} style={{ flex: 1 }}>
      <LinearGradient
        colors={[f.from, f.to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, borderRadius: RADIUS + 4, borderWidth: suggested ? 2 : 1, borderColor: suggested ? colors.primary : colors.border, padding: 12, backgroundColor: colors.card, gap: 6 }}
      >
        <Row style={{ justifyContent: "space-between" }}>
          <f.icon size={24} color={fg} />
          {suggested && (
            <View style={{ backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 7 }}>
              <T size={10} weight="semibold" color="primaryForeground">
                الآن
              </T>
            </View>
          )}
        </Row>
        <T size={14} weight="bold" lines={1}>
          {f.title}
        </T>
        <T size={11} color="mutedForeground" lines={1}>
          {f.note}
        </T>
        <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.muted, overflow: "hidden" }}>
          <View style={{ height: 5, width: `${Math.round(share * 100)}%`, backgroundColor: colors.primary }} />
        </View>
        <T size={10} color="mutedForeground" lines={1}>
          {share <= 0 ? "لم تبدأ اليوم" : share >= 1 ? "أتممتها اليوم" : `${n(Math.round(share * 100))}٪ اليوم`}
        </T>
      </LinearGradient>
    </Pressable>
  );
}

function Group({ g, open: isOpen, onToggle }: { g: AzkarGroup; open: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  const Icon = GROUP_ICONS[g.icon];
  if (!g.chapters.length) return null;
  return (
    <Card padded={false} style={{ overflow: "hidden" }}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
          <Icon size={18} color={colors.primary} />
        </View>
        <T weight="semibold" style={{ flex: 1 }}>
          {g.title}
        </T>
        <T size={12} color="mutedForeground">
          {n(g.chapters.length)} بابًا
        </T>
        <View style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}>
          <ChevronDown size={18} color={colors.mutedForeground} />
        </View>
      </Pressable>
      {isOpen && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
          {g.chapters.map((c, i) => (
            <ChapterRow key={c.id} id={c.id} title={c.title} count={c.items.length} last={i === g.chapters.length - 1} />
          ))}
        </View>
      )}
    </Card>
  );
}

function ChapterRow({ id, title, count, last }: { id: number; title: string; count: number; last: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => open(id)}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
        backgroundColor: pressed ? colors.muted : "transparent",
      })}
    >
      <T size={14} style={{ flex: 1 }}>
        {title}
      </T>
      <T size={12} color="mutedForeground">
        {count > 1 ? `${n(count)} أذكار` : "ذكر واحد"}
      </T>
    </Pressable>
  );
}
