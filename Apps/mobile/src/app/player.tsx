/** The full player: what's playing, a seek bar (and «من البداية» after a resume), previous/next surah or ayah, repeat the surah, speed, a sleep timer, stop. */
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toArabicDigits } from "@lib/content/arabic";
import { ChevronDown, Gauge, Pause, Play, Repeat, SkipBack, SkipForward, Square, Timer } from "@/components/icons";
import { Logo } from "@/components/logo";
import { SceneBackground } from "@/components/scene";
import { Button, IconButton, Row, T } from "@/components/ui";
import { describe, RATES, usePlayer, type Sleep } from "@/core/player";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;
const clock = (s: number) => {
  const t = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return n(h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`);
};

/** The sleep timer's choices, in turn. */
const SLEEPS: { label: string; make: () => Sleep }[] = [
  { label: "بلا مؤقت", make: () => null },
  { label: "بعد ١٥ دقيقة", make: () => ({ kind: "minutes", at: Date.now() + 15 * 60_000 }) },
  { label: "بعد ٣٠ دقيقة", make: () => ({ kind: "minutes", at: Date.now() + 30 * 60_000 }) },
  { label: "بعد ساعة", make: () => ({ kind: "minutes", at: Date.now() + 60 * 60_000 }) },
  { label: "بنهاية المقطع", make: () => ({ kind: "end" }) },
];

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const player = usePlayer();
  const [sleepIdx, setSleepIdx] = useState(0);
  const [barWidth, setBarWidth] = useState(1);
  const t = player.track;

  if (!t) {
    return (
      <View style={{ flex: 1, direction: "rtl", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
        <SceneBackground kind="quiet" />
        <T color="mutedForeground" align="center">
          لا شيء يُشغَّل الآن.
        </T>
        <Button label="التلاوات" variant="outline" onPress={() => router.replace("/recitations")} />
      </View>
    );
  }

  const { title, subtitle } = describe(t, player.live);
  const { playing, buffering, position, duration, error } = player.status;
  const live = t.kind === "radio";
  const share = duration > 0 ? Math.min(position / duration, 1) : 0;
  const sleep = player.sleep;
  const sleepLabel = !sleep ? "مؤقت النوم" : sleep.kind === "end" ? "بنهاية المقطع" : `بعد ${n(Math.max(1, Math.ceil((sleep.at - Date.now()) / 60_000)))} دقيقة`;

  return (
    <View style={{ flex: 1, direction: "rtl" }}>
      <SceneBackground kind="home" />
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 12 }}>
        <IconButton icon={ChevronDown} label="إغلاق" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18, paddingHorizontal: 28 }}>
        <View style={{ width: 200, height: 200, borderRadius: 40, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, elevation: 6 }}>
          <Logo height={110} />
        </View>
        <View style={{ alignItems: "center", gap: 4 }}>
          <T size={22} weight="bold" align="center">
            {title}
          </T>
          <T size={14} color={error ? "destructive" : "mutedForeground"} align="center">
            {error ? "تعذّر التشغيل، تحقق من الاتصال" : live && player.live ? `يُتلى الآن: ${player.live}` : subtitle}
          </T>
        </View>

        {live ? (
          <Row gap={6}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.destructive }} />
            <T size={13} color="mutedForeground">
              بث مباشر
            </T>
          </Row>
        ) : (
          <View style={{ alignSelf: "stretch", gap: 6 }}>
            <Pressable
              onLayout={(e) => setBarWidth(Math.max(1, e.nativeEvent.layout.width))}
              onPress={(e) => duration > 0 && player.seek((1 - e.nativeEvent.locationX / barWidth) * duration)}
              accessibilityRole="adjustable"
              accessibilityLabel="موضع التشغيل"
              hitSlop={12}
              style={{ height: 6, borderRadius: 3, backgroundColor: colors.muted }}
            >
              <View style={{ position: "absolute", top: 0, bottom: 0, start: 0, width: `${share * 100}%`, borderRadius: 3, backgroundColor: colors.primary }} />
            </Pressable>
            {player.resumedAt != null && position - player.resumedAt < 8 ? (
              <Pressable onPress={() => player.seek(0)} accessibilityRole="button" style={{ alignSelf: "center" }}>
                <T size={13} color="primary">
                  تكملة من {clock(player.resumedAt)} · من البداية
                </T>
              </Pressable>
            ) : null}
            <Row style={{ justifyContent: "space-between" }}>
              <T size={12} color="mutedForeground">
                {clock(position)}
              </T>
              <T size={12} color="mutedForeground">
                {clock(duration)}
              </T>
            </Row>
          </View>
        )}

        <Row gap={28}>
          {/* Right to left: the previous one on the right, the next on the left. */}
          <IconButton icon={SkipForward} label="السابق" onPress={player.prev} disabled={!player.hasPrev} size={52} tone="plain" />
          <Pressable
            onPress={player.toggle}
            accessibilityRole="button"
            accessibilityLabel={playing ? "إيقاف مؤقت" : "تشغيل"}
            style={({ pressed }) => ({ width: 78, height: 78, borderRadius: 39, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.96 : 1 }] })}
          >
            {buffering && !playing ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : playing ? (
              <Pause size={32} color={colors.primaryForeground} />
            ) : (
              <Play size={32} color={colors.primaryForeground} />
            )}
          </Pressable>
          <IconButton icon={SkipBack} label="التالي" onPress={player.next} disabled={!player.hasNext} size={52} tone="plain" />
        </Row>

        <Row style={{ flexWrap: "wrap", justifyContent: "center" }}>
          {player.track?.kind === "surah" ? (
            <Button
              label={player.loopSurah ? "تكرار السورة: يعمل" : "كرّر السورة"}
              icon={Repeat}
              size="sm"
              variant={player.loopSurah ? "primary" : "outline"}
              onPress={() => player.setLoopSurah(!player.loopSurah)}
            />
          ) : null}
          {!live ? (
            <Button
              label={`السرعة ×${n(player.rate)}`}
              icon={Gauge}
              size="sm"
              variant="outline"
              onPress={() => player.setRate(RATES[(RATES.indexOf(player.rate) + 1) % RATES.length])}
            />
          ) : null}
          <Button
            label={sleepLabel}
            icon={Timer}
            size="sm"
            variant="outline"
            onPress={() => {
              const next = player.sleep ? (sleepIdx + 1) % SLEEPS.length : 1;
              setSleepIdx(next);
              player.setSleep(SLEEPS[next].make());
            }}
          />
          <Button
            label="إيقاف"
            icon={Square}
            size="sm"
            variant="outline"
            onPress={() => {
              player.stop();
              if (router.canGoBack()) router.back();
            }}
          />
        </Row>
      </View>
      <View style={{ height: insets.bottom + 16 }} />
    </View>
  );
}
