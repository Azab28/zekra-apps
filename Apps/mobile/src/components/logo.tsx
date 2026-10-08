/** The «ذِكرى» logo from src/lib/logo.ts (as src/components/logo.tsx draws it on the site): a lighter ribbon on dark pages. */
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { LOGO_GOLD, LOGO_GOLD_PATH, LOGO_GREEN, LOGO_GREEN_PATH, LOGO_VIEWBOX as V } from "@lib/logo";
import { useTheme } from "@/theme/theme";

/** The site's dark-page ribbon (its `dark:[stop-color:…]` classes). */
const GREEN_DARK = ["#3fae8c", "#5cc6a2", "#2e9677"] as const;

export function Logo({ height = 36 }: { height?: number }) {
  const { dark } = useTheme();
  const green = dark ? GREEN_DARK : LOGO_GREEN;
  return (
    <Svg width={(height * V.w) / V.h} height={height} viewBox={`${V.x} ${V.y} ${V.w} ${V.h}`} accessibilityLabel="ذِكرى">
      <Defs>
        <LinearGradient id="g" x1="180" y1="150" x2="1050" y2="1080" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={green[0]} />
          <Stop offset="0.48" stopColor={green[1]} />
          <Stop offset="1" stopColor={green[2]} />
        </LinearGradient>
        <LinearGradient id="o" x1="150" y1="250" x2="1100" y2="700" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={LOGO_GOLD[0]} />
          <Stop offset="0.48" stopColor={LOGO_GOLD[1]} />
          <Stop offset="1" stopColor={LOGO_GOLD[2]} />
        </LinearGradient>
      </Defs>
      <Path d={LOGO_GREEN_PATH} fill="url(#g)" fillRule="evenodd" />
      <Path d={LOGO_GOLD_PATH} fill="url(#o)" fillRule="evenodd" />
    </Svg>
  );
}
