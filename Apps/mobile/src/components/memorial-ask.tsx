/** After finished azkar (as on the site's reader): a line asking for a prayer for علي متولي عزب, linking his page (/ali). */
import { router } from "expo-router";
import { Text } from "react-native";
import { MEMORIAL } from "@lib/memorial";
import { useTheme } from "@/theme/theme";
import { FAMILY } from "@/theme/fonts";
import { HandHeart } from "./icons";
import { Row } from "./ui";

export function MemorialAsk() {
  const { colors } = useTheme();
  return (
    <Row gap={6} align="flex-start" style={{ maxWidth: 340 }}>
      <HandHeart size={16} color={colors.primary} style={{ marginTop: 4 }} />
      <Text style={{ flex: 1, fontFamily: FAMILY.regular, fontSize: 14, lineHeight: 23, color: colors.mutedForeground, textAlign: "center", writingDirection: "rtl" }}>
        لا تنسَ في دعائك{" "}
        <Text style={{ fontFamily: FAMILY.semibold, color: colors.primary }} onPress={() => router.push("/ali")} accessibilityRole="link">
          {MEMORIAL.name}
        </Text>
        ؛ هذا التطبيق صدقة جارية عنه، رحمه الله.
      </Text>
    </Row>
  );
}
