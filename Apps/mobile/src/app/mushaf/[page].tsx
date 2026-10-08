/**
 * The mushaf, page by page, as the site's /mushaf/[page]: swipe to turn (dragging
 * the page to the right brings the next one), the surah and juz index, go to a
 * page, today's khatma wird, «استمع» ayah by ayah with the recited ayah
 * highlighted (the next page opens by itself), the page as an image or a
 * wallpaper, and an ayah's panel on a tap (components/ayah-panel.tsx).
 */
import { router, useLocalSearchParams } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, ScrollView, View, type GestureResponderEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AYAH_RECITERS, ayahReciter } from "@lib/ayah-audio";
import { toArabicDigits } from "@lib/content/arabic";
import { mushafPageAyat, mushafPageOf, pageInfo } from "@lib/content/mushaf-pages";
import { IMAGE_STYLES } from "@lib/image-styles";
import { AyahPanel } from "@/components/ayah-panel";
import { BookCheck, Check, ChevronLeft, ChevronRight, Image as ImageIcon, List, Pause, Play, Smartphone, UserRound, UsersRound } from "@/components/icons";
import { MushafPage } from "@/components/mushaf-page";
import { SceneBackground } from "@/components/scene";
import { Sheet } from "@/components/sheet";
import { MushafIndex } from "@/components/mushaf-index";
import { Button, IconButton, ListRow, Row, T } from "@/components/ui";
import { todayIn } from "@/core/day";
import { ayahTrack, useAyahOnAir, usePlayer } from "@/core/player";
import { shareImage, type ImageKind } from "@/core/images";
import { MUSHAF_PAGES, saveLastPage, surahName } from "@/core/quran";
import { groupReading, roomCall, setGroupReading, type GroupReading } from "@/core/rooms";
import { useStore } from "@/core/store";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;
const clampPage = (p: number) => Math.min(Math.max(Math.round(p) || 1, 1), MUSHAF_PAGES);

const Page = memo(MushafPage);

export default function MushafScreen() {
  const params = useLocalSearchParams<{ page: string; ayah?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { settings, updateSettings } = useStore();
  const player = usePlayer();
  const onAir = useAyahOnAir();
  const [page, setPage] = useState(() => clampPage(Number(params.page)));
  const [selected, setSelected] = useState<number | null>(() => (params.ayah != null && params.ayah !== "" ? Number(params.ayah) : null));
  const [sheet, setSheet] = useState<"index" | "reciter" | "image" | null>(null);
  const slide = useRef(new Animated.Value(0)).current;
  const touch = useRef<{ x: number; y: number } | null>(null);
  const pendingTap = useRef<ReturnType<typeof setTimeout> | null>(null);

  const info = useMemo(() => pageInfo(page), [page]);
  const ayat = useMemo(() => mushafPageAyat(page), [page]);
  const first = ayat[0] ?? 0;
  const last = ayat[ayat.length - 1] ?? 0;
  const onThisPage = player.track?.kind === "ayah" && player.track.index >= first && player.track.index <= last;
  const playing = player.status.playing || player.status.buffering;

  useEffect(() => {
    void saveLastPage(page);
  }, [page]);

  // While listening, the page with the recited ayah opens by itself.
  useEffect(() => {
    if (onAir == null || (onAir >= first && onAir <= last)) return;
    if (onAir === last + 1) setPage(mushafPageOf(onAir));
  }, [onAir, first, last]);

  /** Turn to another page, sliding the old one out toward `dir` (1: to the right). */
  const go = (p: number, dir: 1 | -1 = p > page ? 1 : -1) => {
    const target = clampPage(p);
    if (target === page) return;
    setSelected(null);
    Animated.timing(slide, { toValue: dir * 60, duration: 110, useNativeDriver: true }).start(() => {
      setPage(target);
      slide.setValue(-dir * 60);
      Animated.timing(slide, { toValue: 0, duration: 140, useNativeDriver: true }).start();
    });
  };

  // Swipe: dragging the page to the right brings the next one in from the left.
  const onTouchStart = (e: GestureResponderEvent) => (touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
  const onTouchEnd = (e: GestureResponderEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = e.nativeEvent.pageX - start.x;
    const dy = e.nativeEvent.pageY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      // A swipe isn't a tap on the ayah under the finger.
      if (pendingTap.current) clearTimeout(pendingTap.current);
      pendingTap.current = null;
      go(dx > 0 ? page + 1 : page - 1, dx > 0 ? 1 : -1);
    }
  };
  // Stable, so the memoized page doesn't redraw on every player tick.
  const onAyah = useCallback((index: number) => {
    if (pendingTap.current) clearTimeout(pendingTap.current);
    pendingTap.current = setTimeout(() => {
      pendingTap.current = null;
      setSelected(index);
    }, 60);
  }, []);

  const listen = () => {
    if (onThisPage) return player.toggle();
    player.play(ayahTrack(settings.reciter, first));
  };

  const title = info.surahs.map((s) => `سورة ${surahName(s)}`).join(" • ");

  return (
    <View style={{ flex: 1, direction: "rtl" }}>
      <SceneBackground kind="quiet" />
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 12, paddingBottom: 6 }}>
        <Row>
          <IconButton icon={ChevronRight} label="رجوع" onPress={() => (router.canGoBack() ? router.back() : router.replace("/quran"))} />
          <View style={{ flex: 1 }}>
            <T size={15} weight="bold" color="primary" lines={1}>
              {title}
            </T>
            <T size={12} color="mutedForeground">
              الجزء {n(info.juz)} · صفحة {n(page)}
            </T>
          </View>
          <IconButton icon={ImageIcon} label="صورة الصفحة" onPress={() => setSheet("image")} />
          <IconButton icon={List} label="الفهرس" onPress={() => setSheet("index")} />
        </Row>
        <Row style={{ marginTop: 8 }}>
          <Pressable
            onPress={listen}
            accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 })}
          >
            {onThisPage && playing ? <Pause size={16} color={colors.primaryForeground} /> : <Play size={16} color={colors.primaryForeground} />}
            <T size={14} weight="medium" color="primaryForeground">
              {onThisPage ? (playing ? "إيقاف مؤقت" : "متابعة") : "استمع"}
            </T>
          </Pressable>
          <Pressable
            onPress={() => setSheet("reciter")}
            accessibilityRole="button"
            accessibilityLabel="القارئ"
            style={({ pressed }) => ({ flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 6, height: 38, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.muted : colors.card })}
          >
            <UserRound size={15} color={colors.mutedForeground} />
            <T size={13} lines={1} style={{ flexShrink: 1 }}>
              {ayahReciter(settings.reciter).name}
            </T>
          </Pressable>
        </Row>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 12, gap: 8 }}>
        <KhatmaBar page={page} />
        <GroupBar page={page} />
        <Animated.View onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ transform: [{ translateX: slide }] }}>
          <Page page={page} onAyah={onAyah} selected={selected} onAir={onAir} />
        </Animated.View>
      </ScrollView>

      <Row style={{ justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 6, paddingBottom: insets.bottom + 10 }}>
        <IconButton icon={ChevronRight} label="الصفحة السابقة" onPress={() => go(page - 1, -1)} disabled={page <= 1} size={46} />
        <T size={13} color="mutedForeground">
          اسحب الصفحة يمينًا للتالية
        </T>
        <IconButton icon={ChevronLeft} label="الصفحة التالية" onPress={() => go(page + 1, 1)} disabled={page >= MUSHAF_PAGES} size={46} />
      </Row>

      <AyahPanel index={selected} ayat={ayat} onChange={setSelected} from="mushaf" />

      <PageImageSheet page={page} open={sheet === "image"} onClose={() => setSheet(null)} />

      <Sheet open={sheet === "index"} onClose={() => setSheet(null)} title="فهرس المصحف">
        <MushafIndex
          onGo={(p) => {
            setSheet(null);
            go(p);
          }}
        />
      </Sheet>

      <Sheet open={sheet === "reciter"} onClose={() => setSheet(null)} title="القارئ">
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          {AYAH_RECITERS.map((r, i) => (
            <ListRow
              key={r.id}
              title={r.name}
              last={i === AYAH_RECITERS.length - 1}
              onPress={() => {
                updateSettings((s) => ({ ...s, reciter: r.id }));
                setSheet(null);
              }}
              trailing={settings.reciter === r.id ? <Check size={18} color={colors.primary} /> : <View />}
            />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

/** Today's khatma wird when this page is in it, with «أنهيت الورد» right here (as the site's KhatmaBar). */
function KhatmaBar({ page }: { page: number }) {
  const { prefs, dispatch } = useStore();
  const { colors } = useTheme();
  const k = prefs.khatma;
  const today = todayIn(prefs.place?.timezone);
  if (!k.page || k.day === today) return null;
  const to = Math.min(k.page + k.daily - 1, MUSHAF_PAGES);
  if (page < k.page || page > to) return null;
  const share = (page - k.page + 1) / (to - k.page + 1);
  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 12, gap: 8 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Row gap={6}>
          <BookCheck size={16} color={colors.primary} />
          <T size={13} weight="semibold">
            وردك اليوم: ص {n(k.page)}–{n(to)}
          </T>
        </Row>
        <Button
          label={page >= to ? "أنهيت الورد" : "أنهيت الورد مبكرًا"}
          size="sm"
          variant={page >= to ? "primary" : "outline"}
          onPress={() => {
            dispatch({ type: "khatma", done: true, day: today });
            router.push("/khatma");
          }}
        />
      </Row>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.muted, overflow: "hidden" }}>
        <View style={{ height: 5, width: `${Math.round(share * 100)}%`, backgroundColor: colors.primary }} />
      </View>
    </View>
  );
}

/** The whole page as an image or a phone wallpaper (the site's «صورة / خلفية» on mushaf pages). */
function PageImageSheet({ page, open, onClose }: { page: number; open: boolean; onClose: () => void }) {
  const { settings } = useStore();
  const { colors } = useTheme();
  const [busy, setBusy] = useState<ImageKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const make = async (kind: ImageKind) => {
    setBusy(kind);
    setError(null);
    setError(await shareImage({ page }, kind, settings.imageStyle, `صفحة ${n(page)} من المصحف`));
    setBusy(null);
  };
  return (
    <Sheet open={open} onClose={onClose} title={`صفحة ${n(page)}`}>
      <View style={{ gap: 10 }}>
        <T size={14} color="mutedForeground">
          الصفحة كما في المصحف، بشكل الصور المختار في الإعدادات ({IMAGE_STYLES[settings.imageStyle].label}).
        </T>
        <Button label={busy === "image" ? "جارٍ التجهيز…" : "صورة الصفحة"} icon={ImageIcon} disabled={!!busy} onPress={() => void make("image")} />
        <Button label={busy === "wallpaper" ? "جارٍ التجهيز…" : "خلفية للموبايل"} icon={Smartphone} variant="outline" disabled={!!busy} onPress={() => void make("wallpaper")} />
        {busy ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? (
          <T size={13} color="destructive">
            {error}
          </T>
        ) : null}
      </View>
    </Sheet>
  );
}

/** A shared khatma's juz being read («اقرأ» on its page), while on its pages: «أتممت الجزء» marks it done there. */
function GroupBar({ page }: { page: number }) {
  const { colors } = useTheme();
  const [reading, setReading] = useState<GroupReading | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    void groupReading().then(setReading);
  }, []);
  if (!reading || page < reading.from || page > reading.to) return null;

  const finish = async () => {
    setBusy(true);
    const r = await roomCall({ action: "tap", slug: reading.slug, juz: reading.juz });
    setBusy(false);
    if (r?.ok) {
      await setGroupReading(null);
      setNote(`أتممت الجزء ${n(reading.juz)}، تقبّل الله منك`);
      setTimeout(() => setReading(null), 2500);
    } else setNote(r?.message ?? "تعذّر الاتصال، حاول مرة أخرى");
  };

  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.card, padding: 12, gap: 8 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Row gap={6} style={{ flex: 1 }}>
          <UsersRound size={16} color={colors.primary} />
          <T size={13} weight="semibold" lines={1} style={{ flex: 1 }}>
            {reading.heading}: الجزء {n(reading.juz)}
          </T>
        </Row>
        <Button label={busy ? "…" : "أتممت الجزء"} size="sm" disabled={busy} onPress={() => void finish()} />
      </Row>
      {note ? (
        <T size={12} color="mutedForeground">
          {note}
        </T>
      ) : null}
      <Pressable onPress={() => router.push({ pathname: "/k/[slug]", params: { slug: reading.slug } })} accessibilityRole="link">
        <T size={12} color="primary">
          صفحة الختمة
        </T>
      </Pressable>
    </View>
  );
}
