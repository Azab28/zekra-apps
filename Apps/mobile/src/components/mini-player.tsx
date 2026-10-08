/** The player in small, above the floating bar on the tabs and at the bottom elsewhere: what's playing, play/pause, stop; a tap opens the full player. */
import { router, useSegments } from "expo-router";
import { ActivityIndicator, Pressable, View } from "react-native";
import { describe, usePlayer } from "@/core/player";
import { useTheme } from "@/theme/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pause, Play, X } from "./icons";
import { BAR_GAP, BAR_HEIGHT, MINI_HEIGHT, useBarBottom, useMiniVisible } from "./layout-metrics";
import { T } from "./ui";

export { useMiniPlayerSpace } from "./layout-metrics";

export function MiniPlayer() {
  const player = usePlayer();
  const visible = useMiniVisible();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const barBottom = useBarBottom();
  const { colors } = useTheme();
  if (!visible || !player.track) return null;
  const inTabs = segments[0] === "(tabs)";
  const bottom = inTabs ? barBottom + BAR_HEIGHT + BAR_GAP : insets.bottom + 8;
  const { title, subtitle } = describe(player.track, player.live);
  const { playing, buffering, error, position, duration } = player.status;
  const share = duration > 0 ? Math.min(position / duration, 1) : 0;

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", start: BAR_GAP, end: BAR_GAP, bottom, direction: "rtl" }}>
      <Pressable
        onPress={() => router.push("/player")}
        accessibilityRole="button"
        accessibilityLabel={`المشغّل: ${title}`}
        style={{
          height: MINI_HEIGHT,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 10,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Pressable
          onPress={player.toggle}
          accessibilityRole="button"
          accessibilityLabel={playing ? "إيقاف مؤقت" : "تشغيل"}
          hitSlop={6}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}
        >
          {buffering && !playing ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : playing ? (
            <Pause size={18} color={colors.primaryForeground} />
          ) : (
            <Play size={18} color={colors.primaryForeground} />
          )}
        </Pressable>
        <View style={{ flex: 1 }}>
          <T size={14} weight="semibold" lines={1}>
            {title}
          </T>
          <T size={12} color={error ? "destructive" : "mutedForeground"} lines={1}>
            {error ? "تعذّر التشغيل، تحقق من الاتصال" : subtitle}
          </T>
        </View>
        <Pressable onPress={player.stop} accessibilityRole="button" accessibilityLabel="إيقاف" hitSlop={8} style={{ padding: 6 }}>
          <X size={18} color={colors.mutedForeground} />
        </Pressable>
        {player.track.kind !== "radio" ? (
          <View style={{ position: "absolute", bottom: 0, start: 0, end: 0, height: 2, backgroundColor: colors.muted }}>
            <View style={{ height: 2, width: `${share * 100}%`, backgroundColor: colors.primary }} />
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
