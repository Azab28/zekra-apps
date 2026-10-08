/** The sections as tiles, two to a row. */
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import type { Section } from "@/core/sections";
import { useTheme } from "@/theme/theme";
import { RADIUS, T } from "./ui";

export function SectionGrid({ sections }: { sections: Section[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {sections.map((s) => (
        <Pressable
          key={s.id}
          onPress={() => router.push(s.href)}
          accessibilityRole="button"
          accessibilityLabel={s.title}
          style={({ pressed }) => ({
            width: "48.5%",
            flexGrow: 1,
            minHeight: 96,
            padding: 14,
            gap: 8,
            borderRadius: RADIUS,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
              <s.icon size={20} color={colors.primary} />
            </View>
          </View>
          <View>
            <T weight="semibold">{s.title}</T>
            <T size={12} color="mutedForeground" lines={1}>
              {s.note}
            </T>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
