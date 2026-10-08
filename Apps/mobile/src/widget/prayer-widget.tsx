/**
 * The home-screen widget (Android, react-native-android-widget): the city and
 * today's date, the next prayer, and the five prayers with the next one
 * marked, in the site's emerald and gold, light and dark. Tapping it opens the
 * app's prayer times. Only ever required lazily (the library's native module
 * throws on import in Expo Go).
 */
import { getLocales } from "expo-localization";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { WidgetModel } from "./model";

const FONT = "IBMPlexSansArabic_400Regular";
const BOLD = "IBMPlexSansArabic_700Bold";

type Hex = `#${string}`;
type Look = { bg: Hex; text: Hex; muted: Hex; accent: Hex; accentText: Hex; cell: Hex };

/** The site's emerald and gold (globals.css, as sRGB). */
const LOOKS: Record<"light" | "dark", Look> = {
  light: { bg: "#fbf8f0", text: "#16201c", muted: "#5f6b66", accent: "#0f5541", accentText: "#f6f1e3", cell: "#efe9da" },
  dark: { bg: "#101a17", text: "#efe6cf", muted: "#a39676", accent: "#1c7a5e", accentText: "#f6f1e3", cell: "#1a2622" },
};

/** The widget draws in the phone's own direction: an LTR phone gets the prayers in reverse, so fajr is on the right either way. */
const rtlPhone = () => getLocales()[0]?.textDirection === "rtl";

function Widget({ model, look }: { model: WidgetModel; look: Look }) {
  if (model.kind === "none") {
    return (
      <FlexWidget clickAction="OPEN_APP" style={{ height: "match_parent", width: "match_parent", backgroundColor: look.bg, borderRadius: 22, justifyContent: "center", alignItems: "center", padding: 12 }}>
        <TextWidget text="مواقيت الصلاة" style={{ fontFamily: BOLD, fontSize: 16, color: look.accent }} />
        <TextWidget text="افتح ذِكرى واختر مدينتك" style={{ fontFamily: FONT, fontSize: 13, color: look.muted }} />
      </FlexWidget>
    );
  }
  const cells = rtlPhone() ? model.prayers : [...model.prayers].reverse();
  const header = [
    <TextWidget key="next" text={`${model.next.label} ${model.next.time}`} style={{ fontFamily: BOLD, fontSize: 16, color: look.accent }} />,
    <FlexWidget key="place" style={{ flexDirection: "column", alignItems: rtlPhone() ? "flex-start" : "flex-end" }}>
      <TextWidget text={model.city} style={{ fontFamily: BOLD, fontSize: 14, color: look.text }} maxLines={1} />
      <TextWidget text={model.date} style={{ fontFamily: FONT, fontSize: 11, color: look.muted }} maxLines={1} />
    </FlexWidget>,
  ];
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: "zekra://prayer" }}
      style={{ height: "match_parent", width: "match_parent", backgroundColor: look.bg, borderRadius: 22, padding: 12, flexDirection: "column", justifyContent: "space-between" }}
    >
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>{rtlPhone() ? header.reverse() : header}</FlexWidget>
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", justifyContent: "space-between", flexGap: 4 }}>
        {cells.map((p) => (
          <FlexWidget
            key={p.key}
            style={{ flex: 1, flexDirection: "column", alignItems: "center", paddingVertical: 6, borderRadius: 12, backgroundColor: p.next ? look.accent : look.cell }}
          >
            <TextWidget text={p.label} style={{ fontFamily: BOLD, fontSize: 12, color: p.next ? look.accentText : look.text }} maxLines={1} />
            <TextWidget text={p.time} style={{ fontFamily: FONT, fontSize: 12, color: p.next ? look.accentText : look.muted }} maxLines={1} />
          </FlexWidget>
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}

/** Both looks: Android picks by the phone's dark mode. */
export const renderPrayerWidget = (model: WidgetModel) => ({
  light: <Widget model={model} look={LOOKS.light} />,
  dark: <Widget model={model} look={LOOKS.dark} />,
});
