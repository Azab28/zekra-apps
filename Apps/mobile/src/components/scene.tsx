/**
 * The site's background (globals.css `.site-bg`): two photos of one mosque
 * (public/bg), the night scene fading into the sunset as the page scrolls,
 * under the theme's background colour so text stays readable and the colour
 * style tints it. «home» shows it fully; «quiet» stays behind reading.
 */
import { Image } from "expo-image";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/theme/theme";

const NIGHT = require("../../../../public/bg/night.webp");
const SUNSET = require("../../../../public/bg/sunset.webp");

export type SceneKind = "home" | "quiet";

/** `progress`: 0 at the top of the page, 1 at its end (the sunset shows from 10% to 85%, as on the site). */
export function SceneBackground({ kind, progress }: { kind: SceneKind; progress?: Animated.Value | Animated.AnimatedInterpolation<number> }) {
  const { colors, dark } = useTheme();
  const o = colors.background;
  const sunset = progress ? progress.interpolate({ inputRange: [0.1, 0.85], outputRange: [0, 1], extrapolate: "clamp" }) : 0;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: o }]} pointerEvents="none">
      {/* Phones: the domes and minarets in the middle of the narrow frame. */}
      <Image source={NIGHT} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ left: "64%", top: "50%" }} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: sunset }]}>
        <Image source={SUNSET} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ left: "48%", top: "50%" }} />
      </Animated.View>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
            {wash(kind, dark).map(([at, a]) => (
              <Stop key={at} offset={at} stopColor={o} stopOpacity={a} />
            ))}
          </LinearGradient>
          <RadialGradient id="top" cx="50%" cy="28%" rx="60%" ry="45%" fx="50%" fy="28%">
            <Stop offset="0" stopColor={o} stopOpacity={dark ? 0.5 : 0.6} />
            <Stop offset="0.75" stopColor={o} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="edge" cx="50%" cy="45%" rx="120%" ry="90%" fx="50%" fy="45%">
            <Stop offset="0.55" stopColor={o} stopOpacity={0} />
            <Stop offset="1" stopColor={o} stopOpacity={0.7} />
          </RadialGradient>
        </Defs>
        {dark && <Rect width="100%" height="100%" fill="url(#edge)" />}
        <Rect width="100%" height="100%" fill="url(#wash)" />
        {kind === "home" && <Rect width="100%" height="100%" fill="url(#top)" />}
      </Svg>
    </View>
  );
}

/** The theme colour over the photos, top to bottom (globals.css `.site-bg::after`). */
function wash(kind: SceneKind, dark: boolean): [number, number][] {
  if (kind === "quiet") return dark ? [[0, 0.86], [1, 0.86]] : [[0, 0.91], [1, 0.91]];
  return dark
    ? [[0, 0.58], [0.5, 0.7], [1, 0.84]]
    : [[0, 0.74], [0.5, 0.84], [1, 0.92]];
}
