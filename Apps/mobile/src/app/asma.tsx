/**
 * The ninety-nine names of Allah as the site's /asma: the list as Jami'
 * at-Tirmidhi 3507 gives it (src/lib/asma.ts, data/asma-husna.json), each
 * as a card in the prayer image's looks drawn by the site (/api/asma-card)
 * to share, and where the list comes from with that narration's gradings.
 */
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { ASMA, ASMA_SOURCE } from "@lib/asma";
import { toArabicDigits } from "@lib/content/arabic";
import { gradeInArabic, scholarName } from "@lib/hadith-grades";
import { DEFAULT_PRAYER_CARD_STYLE, PRAYER_CARD_STYLE_IDS, PRAYER_CARD_STYLES, type PrayerCardStyleId } from "@lib/prayer-card-styles";
import { ExternalLink, Info, Share2 } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Sheet } from "@/components/sheet";
import { Button, Card, Row, T } from "@/components/ui";
import { shareRemoteImage } from "@/core/images";
import { SITE_URL } from "@/core/site";
import { QURAN_FONT } from "@/theme/fonts";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;

export default function Asma() {
  const { colors } = useTheme();
  const [open, setOpen] = useState<number | null>(null);
  const site = (path: string) => void WebBrowser.openBrowserAsync(SITE_URL + path, { toolbarColor: colors.card, controlsColor: colors.primary });

  return (
    <Screen back title="أسماء الله الحسنى">
      <T color="mutedForeground">اضغط أي اسم لتحفظه صورة بالشكل الذي تختاره، أو تشاركه.</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {ASMA.map((name, i) => (
          <Pressable
            key={name}
            onPress={() => setOpen(i + 1)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              width: "48%",
              flexGrow: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: pressed ? colors.muted : colors.card,
              padding: 10,
            })}
          >
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
              <T size={12} weight="semibold" color="primary">
                {n(i + 1)}
              </T>
            </View>
            <T size={20} style={{ fontFamily: QURAN_FONT, lineHeight: 40, flexShrink: 1 }}>
              {name}
            </T>
          </Pressable>
        ))}
      </View>

      <Card style={{ gap: 10 }}>
        <Row gap={6}>
          <Info size={16} color={colors.primary} />
          <T weight="semibold">مصدر القائمة</T>
        </Row>
        <T size={14} color="mutedForeground">
          الأسماء بترتيبها ونصّها من {ASMA_SOURCE.book}، الحديث {n(ASMA_SOURCE.number)}، وأحكام العلماء على هذه الرواية أدناه. وأما عدد الأسماء ففي حديث صحيح (جامع الترمذي ٣٥٠٦).
        </T>
        <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
          {ASMA_SOURCE.grades.map(([scholar, grade], i) => (
            <Row key={i} style={{ justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
              <T size={13} color="mutedForeground">
                {scholarName(scholar)}
              </T>
              <T size={13} weight="medium">
                {gradeInArabic(grade).text}
              </T>
            </Row>
          ))}
        </View>
        <Row style={{ flexWrap: "wrap" }}>
          <Button label="الحديث ٣٥٠٧" icon={ExternalLink} size="sm" variant="outline" onPress={() => site(`/sunnah/tirmidhi/${ASMA_SOURCE.number}`)} />
          <Button label="الحديث ٣٥٠٦" icon={ExternalLink} size="sm" variant="outline" onPress={() => site("/sunnah/tirmidhi/3506")} />
        </Row>
      </Card>

      <NameCard number={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}

function NameCard({ number, onClose }: { number: number | null; onClose: () => void }) {
  const { colors } = useTheme();
  const [style, setStyle] = useState<PrayerCardStyleId>(DEFAULT_PRAYER_CARD_STYLE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = number ? ASMA[number - 1] : "";
  const url = number ? `${SITE_URL}/api/asma-card?n=${number}${style === DEFAULT_PRAYER_CARD_STYLE ? "" : `&style=${style}`}` : "";

  return (
    <Sheet open={number != null} onClose={onClose} title={number ? `الاسم ${n(number)} من أسماء الله الحسنى` : ""}>
      {number ? (
        <View style={{ gap: 12 }}>
          <T size={30} align="center" style={{ fontFamily: QURAN_FONT, lineHeight: 60 }}>
            {name}
          </T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {PRAYER_CARD_STYLE_IDS.map((id) => {
              const on = style === id;
              const look = PRAYER_CARD_STYLES[id].theme;
              return (
                <Pressable
                  key={id}
                  onPress={() => setStyle(id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{ flexGrow: 1, alignItems: "center", gap: 4, padding: 4, borderRadius: 10, borderWidth: on ? 2 : 1, borderColor: on ? colors.primary : colors.border }}
                >
                  <View style={{ width: 40, height: 24, borderRadius: 6, backgroundColor: look.bg[look.bg.length - 1], borderWidth: 1, borderColor: look.accent }} />
                  <T size={11} align="center">
                    {PRAYER_CARD_STYLES[id].label}
                  </T>
                </Pressable>
              );
            })}
          </View>
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.muted, overflow: "hidden", alignItems: "center", justifyContent: "center", minHeight: 220 }}>
            <Image source={{ uri: url }} style={{ width: "100%", aspectRatio: 1080 / 1350 }} contentFit="contain" transition={150} />
          </View>
          <Button
            label={busy ? "جارٍ التجهيز…" : "حفظ أو مشاركة الصورة"}
            icon={Share2}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              setError(null);
              setError(await shareRemoteImage(url, `asma-${number}-${style}`, name));
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
      ) : null}
    </Sheet>
  );
}
