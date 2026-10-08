/**
 * A dua poster for anyone who passed away, as the site's /dua-poster: their
 * name, «له / لها», one of twenty looks and a font; the site draws it
 * (/api/dua-poster, the family's duas from src/lib/dua-poster-text.ts with
 * the name) and the share sheet saves or sends it.
 */
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { posterName } from "@lib/dua-poster-text";
import { DEFAULT_POSTER_FONT } from "@lib/poster-fonts";
import { Posters } from "@/components/posters";
import { Screen } from "@/components/screen";
import { Button, Card, Segmented, T } from "@/components/ui";
import { SITE_URL } from "@/core/site";
import { START } from "@/theme/rtl";
import { useTheme } from "@/theme/theme";

export default function DuaPoster() {
  const params = useLocalSearchParams<{ name?: string; f?: string }>();
  const { colors } = useTheme();
  const [name, setName] = useState(params.name ?? "");
  const [female, setFemale] = useState(params.f === "1");
  const [shown, setShown] = useState<string | null>(params.name ? posterName(params.name) || null : null);
  const clean = posterName(name);

  return (
    <Screen back title="بوستر دعاء للمتوفى">
      <T color="mutedForeground">اكتب اسم من تحب أن تدعو له، واختر شكل البوستر وخطه، ثم احفظه أو أرسله لمن يدعو.</T>
      <Card style={{ gap: 12 }}>
        <T size={13} weight="medium">
          اسم المتوفى
        </T>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={40}
          placeholder="الاسم"
          placeholderTextColor={colors.mutedForeground}
          style={{ height: 46, borderRadius: 12, backgroundColor: colors.muted, paddingHorizontal: 12, color: colors.foreground, fontFamily: "Plex-Regular", fontSize: 16, textAlign: START }}
        />
        <T size={12} color="mutedForeground">
          حروف فقط، حتى ٤٠ حرفًا. لا تكتب «رحمه الله»: البوستر يضيفها.
        </T>
        <Segmented
          options={[
            { value: "m", label: "رجل (له)" },
            { value: "f", label: "امرأة (لها)" },
          ]}
          value={female ? "f" : "m"}
          onChange={(v) => setFemale(v === "f")}
        />
        <Button label="اصنع البوستر" disabled={!clean} onPress={() => setShown(clean)} />
      </Card>
      {shown ? (
        <View>
          <Posters
            key={`${shown}:${female}`}
            url={(style, font) => `${SITE_URL}/api/dua-poster?name=${encodeURIComponent(shown)}${female ? "&f=1" : ""}&style=${style}${font === DEFAULT_POSTER_FONT ? "" : `&font=${font}`}`}
            file="dua-poster"
            title={`دعاء لـ${shown}`}
          />
        </View>
      ) : null}
    </Screen>
  );
}
