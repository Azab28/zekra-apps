/**
 * A dua poster's looks (src/lib/poster-styles.ts: twenty, previewed small by
 * the site), its fonts (src/lib/poster-fonts.ts), the chosen one shown, and
 * save/share through the share sheet. `url(style, font)` is the site's poster
 * address (/api/dua-poster for anyone, /api/memorial-poster for his page).
 */
import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { DEFAULT_POSTER_FONT, POSTER_FONTS } from "@lib/poster-fonts";
import { POSTER_COUNT, posterLabel } from "@lib/poster-styles";
import { shareRemoteImage } from "@/core/images";
import { useTheme } from "@/theme/theme";
import { Share2 } from "./icons";
import { Button, T } from "./ui";

export function Posters({ url, file, title }: { url: (style: number, font: string) => string; file: string; title: string }) {
  const { colors } = useTheme();
  const [style, setStyle] = useState(0);
  const [font, setFont] = useState(DEFAULT_POSTER_FONT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = url(style, font);

  return (
    <View style={{ gap: 12 }}>
      <T size={13} weight="medium">
        الشكل
      </T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {Array.from({ length: POSTER_COUNT }, (_, i) => (
          <Pressable
            key={i}
            onPress={() => setStyle(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: style === i }}
            accessibilityLabel={posterLabel(i)}
            style={{ width: 84, gap: 4, padding: 3, borderRadius: 12, borderWidth: style === i ? 2 : 1, borderColor: style === i ? colors.primary : colors.border }}
          >
            <Image source={{ uri: `${url(i, DEFAULT_POSTER_FONT)}&size=thumb` }} style={{ width: "100%", aspectRatio: 2 / 3, borderRadius: 9 }} contentFit="cover" />
            <T size={10} align="center" lines={2}>
              {posterLabel(i)}
            </T>
          </Pressable>
        ))}
      </ScrollView>

      <T size={13} weight="medium">
        الخط
      </T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {POSTER_FONTS.map((f) => {
          const on = font === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFont(f.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{ borderRadius: 999, borderWidth: 1, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card, paddingHorizontal: 10, paddingVertical: 3 }}
            >
              <T size={12} color={on ? "primaryForeground" : "foreground"}>
                {f.label}
              </T>
            </Pressable>
          );
        })}
      </View>

      <View style={{ alignSelf: "center", width: "85%", borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden", backgroundColor: colors.muted }}>
        <Image source={{ uri: `${chosen}&size=thumb` }} style={{ width: "100%", aspectRatio: 2 / 3 }} contentFit="contain" transition={150} />
      </View>
      <Button
        label={busy ? "جارٍ التجهيز…" : "حفظ أو مشاركة البوستر"}
        icon={Share2}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          setError(null);
          setError(await shareRemoteImage(chosen, `${file}-${style}-${font}`, title, false));
          setBusy(false);
        }}
      />
      {busy ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? (
        <T size={13} color="destructive">
          {error}
        </T>
      ) : null}
    </View>
  );
}
