/**
 * The tab bar: one floating bar like the site's header (globals.css
 * `.site-bar`) in its three looks — ثابت (solid card), زجاجي (frosted, tinted
 * with the colour style), بسيط (the page's own colour, an underline for where
 * you are) — picked in the settings.
 */
import { BlurView } from "expo-blur";
import type { BottomTabBarProps } from "expo-router/tabs";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { alpha, css, mix } from "@/theme/colors";
import { BAR_GAP, BAR_HEIGHT, useBarBottom } from "./layout-metrics";
import { useTheme } from "@/theme/theme";
import type { LucideIcon } from "./icons";
import { T } from "./ui";

export { useBarSpace } from "./layout-metrics";

export type TabMeta = { title: string; icon: LucideIcon };

export function FloatingBar({ state, descriptors, navigation, tabs }: BottomTabBarProps & { tabs: Record<string, TabMeta> }) {
  const bottom = useBarBottom();
  const { raw, colors, nav, dark } = useTheme();
  const look = barLook(nav, raw, dark);
  const content = (
    <View style={{ flexDirection: "row", height: BAR_HEIGHT, paddingHorizontal: 6, alignItems: "center" }}>
      {state.routes.map((route, i) => {
        const meta = tabs[route.name];
        if (!meta) return null;
        const focused = state.index === i;
        const Icon = meta.icon;
        const color = focused ? colors.primary : colors.mutedForeground;
        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={descriptors[route.key]?.options.title ?? meta.title}
            style={({ pressed }) => ({
              flex: 1,
              height: BAR_HEIGHT - 12,
              marginHorizontal: 2,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              backgroundColor: focused ? look.active : pressed ? look.hover : "transparent",
            })}
          >
            <Icon size={21} color={color} strokeWidth={focused ? 2.2 : 1.8} />
            <T size={11} weight={focused ? "semibold" : "medium"} color={color} align="center" lines={1} style={{ lineHeight: 16 }}>
              {meta.title}
            </T>
            {nav === "minimal" && focused && <View style={{ position: "absolute", bottom: 3, width: 18, height: 2.5, borderRadius: 2, backgroundColor: colors.primary }} />}
          </Pressable>
        );
      })}
    </View>
  );
  return (
    <View pointerEvents="box-none" style={{ direction: "rtl", position: "absolute", start: BAR_GAP, end: BAR_GAP, bottom }}>
      <View
        style={{
          borderRadius: 20,
          borderWidth: look.border ? 1 : 0,
          borderColor: look.border ?? "transparent",
          overflow: "hidden",
          backgroundColor: look.blur > 0 && Platform.OS === "ios" ? "transparent" : look.bg,
          shadowColor: "#000",
          shadowOpacity: look.shadow,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: look.shadow ? 8 : 0,
        }}
      >
        {look.blur > 0 && Platform.OS === "ios" && (
          <>
            <BlurView intensity={look.blur} tint={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: look.bg }]} />
          </>
        )}
        {content}
      </View>
    </View>
  );
}

/** The bar's colours per look, from globals.css `.site-bar` (Android has no cheap live blur: a little more opaque there). */
function barLook(nav: "solid" | "glass" | "minimal", raw: ReturnType<typeof useTheme>["raw"], dark: boolean) {
  const opaque = Platform.OS === "ios" ? 1 : 1.18;
  if (nav === "glass") {
    return {
      bg: css(alpha(mix(raw.card, raw.primary, 0.88), Math.min(0.74 * opaque, 0.94))),
      border: css(alpha(raw.foreground, 0.12)),
      shadow: 0.3,
      blur: 40,
      hover: css(alpha(raw.foreground, 0.08)),
      active: css(alpha(raw.foreground, 0.1)),
    };
  }
  if (nav === "minimal") {
    return {
      bg: css(alpha(raw.background, Math.min(0.88 * opaque, 0.97))),
      border: null,
      shadow: 0,
      blur: 20,
      hover: css(alpha(raw.foreground, 0.06)),
      active: "transparent",
    };
  }
  return {
    bg: css(alpha(raw.card, 0.97)),
    border: css(raw.border),
    shadow: dark ? 0.4 : 0.16,
    blur: 0,
    hover: css(alpha(raw.foreground, 0.06)),
    active: css(alpha(raw.primary, 0.12)),
  };
}
