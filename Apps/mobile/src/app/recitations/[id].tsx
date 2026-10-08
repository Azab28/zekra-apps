/** One reciter: their recitations (riwayat) and each one's surahs, played from mp3quran.net and going on to the next surah, or saved on the device for offline listening. */
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { reciters } from "@lib/content/data";
import { toArabicDigits } from "@lib/content/arabic";
import { CircleCheckBig, CircleX, ChevronRight, Download, Pause, Play, Star } from "@/components/icons";
import { useDialogs } from "@/components/sheet";
import { useMiniPlayerSpace } from "@/components/layout-metrics";
import { SceneBackground } from "@/components/scene";
import { Button, Card, IconButton, Row, T } from "@/components/ui";
import { cancelDownload, cancelMoshaf, queueDownloads, removeSurah, savedCount, surahState, useDownloads, type MoshafInfo } from "@/core/downloads";
import { usePlayer } from "@/core/player";
import { surahs } from "@/core/quran";
import { useStore } from "@/core/store";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;

export default function Reciter() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const mini = useMiniPlayerSpace();
  const player = usePlayer();
  const dialogs = useDialogs();
  const { settings, updateSettings } = useStore();
  useDownloads();
  const reciter = useMemo(() => reciters().find((r) => r.id === Number(id)), [id]);
  const [moshafId, setMoshafId] = useState<number | null>(reciter?.moshaf[0]?.id ?? null);
  const moshaf = reciter?.moshaf.find((m) => m.id === moshafId) ?? reciter?.moshaf[0];
  const names = surahs();

  const fav = !!reciter && settings.listen.favReciters.includes(reciter.id);
  const back = (
    <Row>
      <IconButton icon={ChevronRight} label="رجوع" onPress={() => (router.canGoBack() ? router.back() : router.replace("/recitations"))} />
      <T size={20} weight="bold" style={{ flex: 1 }} lines={1}>
        {reciter?.name ?? "التلاوات"}
      </T>
      {reciter ? (
        <IconButton
          icon={Star}
          label={fav ? "إزالة من المفضّلة" : "إضافة إلى المفضّلة"}
          tone={fav ? "primary" : "muted"}
          onPress={() =>
            updateSettings((s) => ({ ...s, listen: { ...s.listen, favReciters: fav ? s.listen.favReciters.filter((x) => x !== reciter.id) : [...s.listen.favReciters, reciter.id] } }))
          }
        />
      ) : null}
    </Row>
  );

  if (!reciter || !moshaf) {
    return (
      <View style={{ flex: 1, direction: "rtl", paddingTop: insets.top + 8, paddingHorizontal: 16, gap: 12 }}>
        <SceneBackground kind="quiet" />
        {back}
        <Card>
          <T color="mutedForeground">لم نجد هذا القارئ.</T>
        </Card>
      </View>
    );
  }

  const current = player.track?.kind === "surah" && player.track.moshafId === moshaf.id ? player.track.surah : null;
  const playing = player.status.playing || player.status.buffering;
  const info: MoshafInfo = { reciter: reciter.name, reciterId: reciter.id, moshaf: moshaf.name, moshafId: moshaf.id, server: moshaf.server, surahs: moshaf.surahs };
  const saved = savedCount(moshaf.id);
  const busy = moshaf.surahs.some((s) => {
    const k = surahState(moshaf.id, s).kind;
    return k === "queued" || k === "loading";
  });

  const downloadAll = async () => {
    const ok = await dialogs.confirm({
      title: "تحميل كل السور؟",
      message: "تُحفظ السور على جهازك لتسمعها بلا إنترنت. المصحف كاملًا بصوت قارئ واحد قد يأخذ مئات الميجابايت، فيُفضّل التحميل على شبكة واي فاي.",
      confirm: "حمّل",
    });
    if (ok) queueDownloads(info, moshaf.surahs);
  };

  /** A surah's download button: start, progress (tap to stop), saved (tap to delete). */
  const onDownload = async (s: number) => {
    const state = surahState(moshaf.id, s);
    if (state.kind === "queued" || state.kind === "loading") return cancelDownload(moshaf.id, s);
    if (state.kind === "done") {
      const ok = await dialogs.confirm({ title: `حذف سورة ${names[s - 1]?.name} من الجهاز؟`, confirm: "احذف", danger: true });
      if (ok) removeSurah(moshaf.id, s);
      return;
    }
    queueDownloads(info, [s]);
  };

  return (
    <View style={{ flex: 1, direction: "rtl" }}>
      <SceneBackground kind="quiet" />
      <FlatList
        data={moshaf.surahs}
        keyExtractor={(s) => String(s)}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + mini + 16 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            {back}
            {reciter.moshaf.length > 1 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {reciter.moshaf.map((m) => {
                  const on = m.id === moshaf.id;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => setMoshafId(m.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={{ borderRadius: 999, borderWidth: 1, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card, paddingHorizontal: 12, paddingVertical: 5 }}
                    >
                      <T size={13} color={on ? "primaryForeground" : "foreground"}>
                        {m.name}
                      </T>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <T color="mutedForeground">{moshaf.name}</T>
            )}
            {settings.listen.moshafId === moshaf.id ? (
              <Row gap={6}>
                <CircleCheckBig size={14} color={colors.primary} />
                <T size={13} color="primary">
                  القارئ المختار للاقتراحات والمنبّه
                </T>
              </Row>
            ) : (
              <Button
                label="اجعله المختار للاقتراحات والمنبّه"
                icon={Star}
                size="sm"
                variant="outline"
                onPress={() => updateSettings((s) => ({ ...s, listen: { ...s.listen, reciterId: reciter.id, moshafId: moshaf.id } }))}
              />
            )}
            <Row style={{ justifyContent: "space-between" }}>
              <T size={13} color="mutedForeground">
                {n(moshaf.surahs.length)} سورة{saved > 0 ? ` · ${n(saved)} محفوظة على الجهاز` : ""}
              </T>
              {busy ? (
                <Button label="إيقاف التحميل" icon={CircleX} size="sm" variant="outline" onPress={() => cancelMoshaf(moshaf.id)} />
              ) : saved < moshaf.surahs.length ? (
                <Button label="تحميل الكل" icon={Download} size="sm" variant="outline" onPress={() => void downloadAll()} />
              ) : null}
            </Row>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
        renderItem={({ item: s }) => {
          const on = current === s;
          return (
            <Pressable
              onPress={() =>
                on
                  ? player.toggle()
                  : player.play({ kind: "surah", reciter: reciter.name, reciterId: reciter.id, moshaf: moshaf.name, moshafId: moshaf.id, server: moshaf.server, surahs: moshaf.surahs, surah: s })
              }
              accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 6, backgroundColor: on ? colors.accent : pressed ? colors.muted : "transparent", borderRadius: 10 })}
            >
              <T size={13} color="mutedForeground" style={{ width: 32 }} align="center">
                {n(s)}
              </T>
              <T weight={on ? "bold" : "medium"} color={on ? "primary" : "foreground"} style={{ flex: 1 }}>
                سورة {names[s - 1]?.name}
              </T>
              {on && playing ? <Pause size={18} color={colors.primary} /> : <Play size={18} color={on ? colors.primary : colors.mutedForeground} />}
              <DownloadButton state={surahState(moshaf.id, s)} onPress={() => void onDownload(s)} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

/** Not saved (download), queued or loading (its share; tap to stop), saved (a tick; tap to delete). */
function DownloadButton({ state, onPress }: { state: ReturnType<typeof surahState>; onPress: () => void }) {
  const { colors } = useTheme();
  const label = state.kind === "done" ? "محفوظة على الجهاز، اضغط للحذف" : state.kind === "loading" || state.kind === "queued" ? "إيقاف التحميل" : "تحميل للاستماع بلا إنترنت";
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} style={{ minWidth: 34, alignItems: "center" }}>
      {state.kind === "done" ? (
        <CircleCheckBig size={18} color={colors.primary} />
      ) : state.kind === "loading" ? (
        <T size={11} weight="semibold" color="primary" align="center">
          {n(Math.round(state.progress * 100))}٪
        </T>
      ) : state.kind === "queued" ? (
        <T size={11} color="mutedForeground" align="center">
          بالدور
        </T>
      ) : (
        <Download size={18} color={state.kind === "error" ? colors.destructive : colors.mutedForeground} />
      )}
    </Pressable>
  );
}
