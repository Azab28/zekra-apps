/** The site's image looks (src/lib/image-styles.ts) as swatches: a small page in each look's paper, ink and frame. */
import { Pressable, Text, View } from "react-native";
import { quran } from "@lib/content/data";
import { IMAGE_STYLE_IDS, IMAGE_STYLES, type ImageStyleId } from "@lib/image-styles";
import { QURAN_FONT } from "@/theme/fonts";
import { useTheme } from "@/theme/theme";
import { Check } from "./icons";
import { T } from "./ui";

/** The basmala's first words from data/quran.json, as a sample of the ink. */
const sample = () => quran().basmala.split(" ").slice(0, 2).join(" ");

export function StylePicker({ value, onChange }: { value: ImageStyleId; onChange: (v: ImageStyleId) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {IMAGE_STYLE_IDS.map((id) => {
        const s = IMAGE_STYLES[id];
        const on = value === id;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={s.label}
            style={{ width: "30%", flexGrow: 1, alignItems: "center", gap: 6 }}
          >
            <View
              style={{
                width: "100%",
                height: 64,
                borderRadius: 12,
                borderWidth: on ? 3 : 2,
                borderColor: on ? colors.primary : s.theme.band,
                backgroundColor: s.theme.paper,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontFamily: QURAN_FONT, fontSize: 20, color: s.theme.ink }}>{sample()}</Text>
              {on ? (
                <View style={{ position: "absolute", top: 4, end: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                  <Check size={12} color={colors.primaryForeground} />
                </View>
              ) : null}
            </View>
            <T size={12} weight={on ? "semibold" : "regular"} align="center">
              {s.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
