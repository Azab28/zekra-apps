/** The round counter button of the azkar reader and the tasbeeh, with a ring for how far into the number. */
import * as Haptics from "expo-haptics";
import { Pressable, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "@/theme/theme";
import type { ReactNode } from "react";

/** A light tap per count, a success buzz when a number is reached. */
export function haptic(kind: "tap" | "done") {
  void (kind === "tap" ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)).catch(() => undefined);
}

export function CounterButton({ size, value, dim, onPress, label, children }: { size: number; value: number | null; dim?: boolean; onPress: () => void; label: string; children: ReactNode }) {
  const { colors } = useTheme();
  const stroke = Math.max(3, size * 0.045);
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primary,
        opacity: dim ? 0.75 : 1,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ scale: pressed ? 0.96 : 1 }],
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      })}
    >
      {value != null && (
        <View style={{ position: "absolute", top: 0, start: 0 }} pointerEvents="none">
          <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
            <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.primaryForeground} strokeOpacity={0.25} strokeWidth={stroke} />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={colors.primaryForeground}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${c} ${c}`}
              strokeDashoffset={c * (1 - Math.min(Math.max(value, 0), 1))}
            />
          </Svg>
        </View>
      )}
      {children}
    </Pressable>
  );
}
