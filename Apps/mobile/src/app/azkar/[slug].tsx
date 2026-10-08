/**
 * One azkar set, as the site's reader (/r/<slug>): one zikr at a time with a
 * tap counter, moving on by itself when the number is reached; swipe to move;
 * «عرض الكل» lists them all. Today's progress is kept on the device.
 */
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Share, View, type GestureResponderEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { repeatLabel, toArabicDigits } from "@lib/content/arabic";
import { CounterButton, haptic } from "@/components/counter";
import { FeedbackForm } from "@/components/feedback-form";
import { Check, ChevronLeft, ChevronRight, Copy, Flag, List, Minus, Plus, Repeat, RotateCcw, Share2, SquareStack } from "@/components/icons";
import { MemorialAsk } from "@/components/memorial-ask";
import { SceneBackground } from "@/components/scene";
import { Sheet } from "@/components/sheet";
import { Button, Card, IconButton, RADIUS, Row, T } from "@/components/ui";
import { todayIn } from "@/core/day";
import { AFTER, azkarSet, type AzkarItem } from "@/core/hisn";
import { loadProgress, saveProgress } from "@/core/reader-progress";
import { SITE_URL } from "@/core/site";
import { readJson, writeJson } from "@/core/storage";
import { useStore } from "@/core/store";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;
const SIZES = [18, 20, 23, 26, 30];

type Progress = { index: number; counts: number[] };

export default function AzkarReader() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const set = useMemo(() => azkarSet(String(slug)), [slug]);
  const [loaded, setLoaded] = useState<Progress | null>(null);

  useEffect(() => {
    if (!set) return;
    setLoaded(null);
    void loadProgress(set.slug, set.items.length).then((p) => setLoaded(p ?? { index: 0, counts: set.items.map(() => 0) }));
  }, [set]);

  if (!set) {
    return (
      <Frame title="الأذكار">
        <Card style={{ margin: 16 }}>
          <T color="mutedForeground">لم نجد هذه الأذكار.</T>
        </Card>
      </Frame>
    );
  }
  if (!loaded) return <Frame title={set.title}>{null}</Frame>;
  return <Reader key={set.slug} slug={set.slug} title={set.title} items={set.items} initial={loaded} />;
}

/** The page around the reader: the quiet scene and a header with the back button. */
function Frame({ title, actions, progress, children }: { title: string; actions?: ReactNode; progress?: ReactNode; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, direction: "rtl" }}>
      <SceneBackground kind="quiet" />
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 6 }}>
        <Row>
          <IconButton icon={ChevronRight} label="رجوع" onPress={() => (router.canGoBack() ? router.back() : router.replace("/azkar"))} />
          <T size={17} weight="bold" lines={1} style={{ flex: 1 }}>
            {title}
          </T>
          {actions}
        </Row>
        {progress}
      </View>
      {children}
    </View>
  );
}

function Reader({ slug, title, items, initial }: { slug: string; title: string; items: AzkarItem[]; initial: Progress }) {
  const { colors } = useTheme();
  const { prefs, dispatch } = useStore();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(Math.min(initial.index, items.length - 1));
  const [counts, setCounts] = useState(initial.counts);
  const [mode, setMode] = useState<"one" | "all">("one");
  const [size, setSize] = useState(1);
  const [copied, setCopied] = useState(false);
  const [reporting, setReporting] = useState(false);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const finished = counts.every((c, i) => c >= items[i].repeat);
  const wasFinished = useRef(finished);

  useEffect(() => {
    void readJson<number>("reader:size").then((s) => {
      if (typeof s === "number" && s >= 0 && s < SIZES.length) setSize(s);
    });
    return () => {
      if (advance.current) clearTimeout(advance.current);
    };
  }, []);

  useEffect(() => {
    void saveProgress(slug, { index, counts });
  }, [slug, index, counts]);

  useEffect(() => {
    if (finished && !wasFinished.current) {
      haptic("done");
      // Counts toward the wird streak of a signed-in account (like the site's reader); on the device alone it changes nothing.
      dispatch({ type: "azkar", day: todayIn(prefs.place?.timezone) });
    }
    wasFinished.current = finished;
  }, [finished, dispatch, prefs.place?.timezone]);

  const go = useCallback((i: number) => setIndex(Math.min(Math.max(i, 0), items.length - 1)), [items.length]);

  const tap = () => {
    const item = items[index];
    const count = counts[index];
    if (count >= item.repeat) return go(index + 1);
    const next = count + 1;
    setCounts((c) => c.map((x, i) => (i === index ? next : x)));
    haptic("tap");
    if (next >= item.repeat && index < items.length - 1) {
      if (advance.current) clearTimeout(advance.current);
      advance.current = setTimeout(() => go(index + 1), 450);
    }
  };

  // Right to left: a swipe toward the right goes forward. A swipe on the text
  // moves instead of counting (Pressable calls onPressOut before onPress).
  const onPressIn = (e: GestureResponderEvent) => {
    touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    swiped.current = false;
  };
  const onPressOut = (e: GestureResponderEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = e.nativeEvent.pageX - start.x;
    const dy = e.nativeEvent.pageY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    swiped.current = true;
    go(index + (dx > 0 ? 1 : -1));
  };
  const onTextPress = () => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    tap();
  };

  const restart = () => {
    setCounts(items.map(() => 0));
    setIndex(0);
    setMode("one");
  };

  const setFont = (d: number) => {
    const s = Math.min(Math.max(size + d, 0), SIZES.length - 1);
    setSize(s);
    void writeJson("reader:size", s);
  };

  const copy = async () => {
    await Clipboard.setStringAsync(`${items[index].text}\n\n— ${title}، حصن المسلم`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const share = () => void Share.share({ message: `${title} من حصن المسلم\n${SITE_URL}/r/${slug}` });

  const item = items[index];
  const count = counts[index];
  const completed = counts.filter((c, i) => c >= items[i].repeat).length;
  const fontSize = SIZES[size];

  const progress = (
    <Row gap={8}>
      <T size={12} color="mutedForeground">
        {mode === "one" ? `الذكر ${n(index + 1)} من ${n(items.length)}` : `${n(completed)} من ${n(items.length)} مكتمل`}
      </T>
      <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.muted, overflow: "hidden" }}>
        <View style={{ height: 6, width: `${(completed / items.length) * 100}%`, backgroundColor: colors.primary }} />
      </View>
    </Row>
  );
  const actions = (
    <Row gap={4}>
      <IconButton icon={Minus} label="تصغير الخط" onPress={() => setFont(-1)} size={36} />
      <IconButton icon={Plus} label="تكبير الخط" onPress={() => setFont(1)} size={36} />
      <IconButton icon={mode === "one" ? List : SquareStack} label={mode === "one" ? "عرض الكل" : "ذكر ذكر"} onPress={() => setMode(mode === "one" ? "all" : "one")} size={36} />
    </Row>
  );

  if (finished && mode === "one") {
    const after = AFTER[slug] ?? [];
    return (
      <Frame title={title} actions={actions} progress={progress}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14, paddingBottom: insets.bottom + 24 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
            <Check size={40} color={colors.primary} />
          </View>
          <T size={20} weight="bold" align="center">
            أتممت {title}
          </T>
          <T color="mutedForeground" align="center">
            تقبّل الله منا ومنكم
          </T>
          <MemorialAsk />
          <Row style={{ flexWrap: "wrap", justifyContent: "center" }}>
            <Button label="من جديد" icon={RotateCcw} variant="outline" size="sm" onPress={restart} />
            <Button label="شارك" icon={Share2} size="sm" onPress={share} />
          </Row>
          {after.length > 0 ? (
            <View style={{ width: "100%", maxWidth: 320, gap: 8 }}>
              <T size={12} color="mutedForeground" align="center">
                بعدها:
              </T>
              {after.map((a) => (
                <Pressable
                  key={a.slug}
                  onPress={() => router.replace({ pathname: "/azkar/[slug]", params: { slug: a.slug } })}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.muted : colors.card, paddingHorizontal: 16, paddingVertical: 12 })}
                >
                  <T size={14} weight="medium" align="center">
                    {a.label}
                  </T>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </Frame>
    );
  }

  if (mode === "all") {
    return (
      <Frame title={title} actions={actions} progress={progress}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}>
          {items.map((it, i) => {
            const done = counts[i] >= it.repeat;
            return (
              <Pressable
                key={i}
                onPress={() => {
                  go(i);
                  setMode("one");
                }}
                accessibilityRole="button"
                style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: done ? colors.primary : colors.border, backgroundColor: colors.card, padding: 16, gap: 8 }}
              >
                <T size={fontSize - 2} style={{ lineHeight: Math.round((fontSize - 2) * 1.9) }}>
                  {it.text}
                </T>
                <Row gap={4}>
                  {done ? <Check size={14} color={colors.primary} /> : null}
                  <T size={12} color="mutedForeground">
                    {repeatLabel(it.repeat) || "مرة واحدة"}
                  </T>
                </Row>
              </Pressable>
            );
          })}
        </ScrollView>
      </Frame>
    );
  }

  return (
    <Frame title={title} actions={actions} progress={progress}>
      <View style={{ flex: 1, padding: 16, gap: 8 }}>
        <View style={{ flex: 1, borderRadius: RADIUS + 4, borderWidth: 1, borderColor: count >= item.repeat ? colors.primary : colors.border, backgroundColor: colors.card, overflow: "hidden" }}>
          <ScrollView contentContainerStyle={{ padding: 20, flexGrow: 1 }}>
            <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={onTextPress} accessibilityRole="button" accessibilityHint="اضغط للعدّ" style={{ flexGrow: 1 }}>
              <T size={fontSize} style={{ lineHeight: Math.round(fontSize * 1.95) }}>
                {item.text}
              </T>
            </Pressable>
          </ScrollView>
        </View>
        <Row style={{ justifyContent: "space-between" }}>
          <Row gap={4}>
            {item.repeat > 1 ? <Repeat size={14} color={colors.mutedForeground} /> : null}
            <T size={13} color="mutedForeground">
              {item.repeat > 1 ? repeatLabel(item.repeat) : "مرة واحدة"}
            </T>
          </Row>
          <Row gap={14}>
            <Pressable onPress={() => void copy()} accessibilityRole="button" accessibilityLabel="نسخ الذكر" hitSlop={8}>
              <Row gap={4}>
                {copied ? <Check size={14} color={colors.primary} /> : <Copy size={14} color={colors.mutedForeground} />}
                <T size={13} color={copied ? "primary" : "mutedForeground"}>
                  {copied ? "نُسخ" : "نسخ"}
                </T>
              </Row>
            </Pressable>
            <Pressable onPress={() => setReporting(true)} accessibilityRole="button" accessibilityLabel="بلّغ عن خطأ في هذا الذكر" hitSlop={8}>
              <Row gap={4}>
                <Flag size={14} color={colors.mutedForeground} />
                <T size={13} color="mutedForeground">
                  بلّغ عن خطأ
                </T>
              </Row>
            </Pressable>
          </Row>
        </Row>
        <Sheet open={reporting} onClose={() => setReporting(false)} title="بلّغ عن خطأ">
          <FeedbackForm context={{ type: "zikr", ref: `${slug}:${index + 1}`, label: `${title} (${toArabicDigits(index + 1)})`, url: `/r/${slug}` }} onDone={() => setReporting(false)} />
        </Sheet>
        <T size={11} color="mutedForeground" align="center" style={{ opacity: 0.8 }}>
          اضغط على الذكر أو الزر للعدّ، واسحب يمينًا ويسارًا للتنقل
        </T>
      </View>
      <Row style={{ justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 4, paddingBottom: insets.bottom + 14 }}>
        <IconButton icon={ChevronRight} label="السابق" onPress={() => go(index - 1)} disabled={index === 0} size={54} />
        <CounterButton size={112} value={count / item.repeat} dim={count >= item.repeat} onPress={tap} label="سبّح">
          {count >= item.repeat ? (
            <>
              <Check size={32} color={colors.primaryForeground} />
              <T size={12} color="primaryForeground" align="center">
                التالي
              </T>
            </>
          ) : (
            <>
              <T size={26} weight="bold" color="primaryForeground" align="center" style={{ lineHeight: 34 }}>
                {n(count)}
              </T>
              <T size={12} color="primaryForeground" align="center" style={{ opacity: 0.85 }}>
                من {n(item.repeat)}
              </T>
            </>
          )}
        </CounterButton>
        <IconButton icon={ChevronLeft} label="التالي" onPress={() => go(index + 1)} disabled={index === items.length - 1} size={54} />
      </Row>
    </Frame>
  );
}
