/** The look on this device: light/dark, the site's six colour styles, the floating bar's three looks, and the reading looks (large text, the mushaf page, ayah images). */
import { Pressable, View } from "react-native";
import { PALETTES } from "@lib/palettes";
import { Check, Monitor, Moon, Sun } from "@/components/icons";
import { Screen } from "@/components/screen";
import { StylePicker } from "@/components/style-picker";
import { Card, Segmented, SectionTitle, SwitchRow, T } from "@/components/ui";
import type { NavStyle } from "@/core/settings";
import { useStore } from "@/core/store";
import { makeTheme } from "@/theme/colors";
import { useTheme } from "@/theme/theme";
import { TAJWEED_SUPPORTED } from "@/core/qcf-fonts";
import { SITE_URL } from "@/core/site";
import Constants from "expo-constants";

const NAV_LOOKS: { value: NavStyle; label: string; note: string }[] = [
  { value: "solid", label: "ثابت", note: "شريط واضح فوق الصفحة" },
  { value: "glass", label: "زجاجي", note: "شفاف بلون التطبيق" },
  { value: "minimal", label: "بسيط", note: "بلون الصفحة وخط تحت القسم" },
];

export default function SettingsScreen() {
  const { settings, updateSettings } = useStore();
  const { colors, dark } = useTheme();
  return (
    <Screen back title="الإعدادات">
      <SectionTitle>المظهر</SectionTitle>
      <Segmented
        options={[
          { value: "light", label: "فاتح", icon: Sun },
          { value: "dark", label: "داكن", icon: Moon },
          { value: "system", label: "الجهاز", icon: Monitor },
        ]}
        value={settings.theme}
        onChange={(theme) => updateSettings((s) => ({ ...s, theme }))}
      />

      <SectionTitle>اللون</SectionTitle>
      <Card style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
        {PALETTES.map((p) => {
          const on = settings.palette === p.id;
          const swatch = makeTheme(dark, p.id).colors.primary;
          return (
            <Pressable
              key={p.id}
              onPress={() => updateSettings((s) => ({ ...s, palette: p.id }))}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={p.label}
              style={{ width: "30%", alignItems: "center", gap: 6, paddingVertical: 6 }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: swatch,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: on ? 3 : 0,
                  borderColor: colors.background,
                  outlineColor: swatch,
                  outlineWidth: on ? 2 : 0,
                }}
              >
                {on && <Check size={20} color={makeTheme(dark, p.id).colors.primaryForeground} />}
              </View>
              <T size={12} align="center" weight={on ? "semibold" : "regular"}>
                {p.label}
              </T>
            </Pressable>
          );
        })}
      </Card>

      <SectionTitle>شكل الشريط السفلي</SectionTitle>
      <View style={{ gap: 8 }}>
        {NAV_LOOKS.map((l) => {
          const on = settings.nav === l.value;
          return (
            <Pressable
              key={l.value}
              onPress={() => updateSettings((s) => ({ ...s, nav: l.value }))}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 14,
                borderRadius: 18,
                borderWidth: on ? 2 : 1,
                borderColor: on ? colors.primary : colors.border,
                backgroundColor: colors.card,
              }}
            >
              <View style={{ flex: 1 }}>
                <T weight="semibold">{l.label}</T>
                <T size={13} color="mutedForeground">
                  {l.note}
                </T>
              </View>
              {on && <Check size={20} color={colors.primary} />}
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>القراءة</SectionTitle>
      <Card padded={false} style={{ overflow: "hidden" }}>
        <SwitchRow title="خط كبير" note="يكبّر نصوص التطبيق كلها" value={settings.large} onChange={(large) => updateSettings((s) => ({ ...s, large }))} />
        <SwitchRow
          title="مصحف التجويد الملوّن"
          note={TAJWEED_SUPPORTED ? "ألوان أحكام التجويد في صفحات المصحف، على صفحة فاتحة" : "يحتاج أندرويد ١٣ أو أحدث؛ لا يرسم هذا الجهاز ألوان الخط"}
          value={settings.tajweed && TAJWEED_SUPPORTED}
          disabled={!TAJWEED_SUPPORTED}
          onChange={(tajweed) => updateSettings((s) => ({ ...s, tajweed }))}
          last
        />
      </Card>
      <T size={13} weight="medium" style={{ marginTop: 4 }}>
        شكل صفحة المصحف
      </T>
      <T size={12} color="mutedForeground">
        «كلاسيكي» يتبع الوضع الفاتح والداكن، و«ليلي» مريح للعين في الظلام.
      </T>
      <StylePicker value={settings.pageStyle} onChange={(pageStyle) => updateSettings((s) => ({ ...s, pageStyle }))} />
      <T size={13} weight="medium" style={{ marginTop: 4 }}>
        شكل صور الآيات والصفحات
      </T>
      <T size={12} color="mutedForeground">
        يُستخدم في «صورة» و«خلفية» عند الآيات وصفحات المصحف.
      </T>
      <StylePicker value={settings.imageStyle} onChange={(imageStyle) => updateSettings((s) => ({ ...s, imageStyle }))} />

      <T size={12} color="mutedForeground" align="center" style={{ marginTop: 16 }}>
        ذِكرى {Constants.expoConfig?.version ?? ""} · {SITE_URL.replace("https://", "")}
      </T>
    </Screen>
  );
}
