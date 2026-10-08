/** Search the Quran text with the site's and the bot's search (src/lib/content/quran-search.ts: the Uthmani-aware letter skeleton). */
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { mushafPageOf } from "@lib/content/mushaf-pages";
import { searchQuran } from "@lib/content/quran-search";
import { Search as SearchIcon } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Button, Card, Row, T } from "@/components/ui";
import { ayahAt } from "@/core/quran";
import { QURAN_FONT } from "@/theme/fonts";
import { START } from "@/theme/rtl";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;
const STEP = 40;

export default function Search() {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [shown, setShown] = useState(STEP);

  // Search as you type, a moment after the last key.
  useEffect(() => {
    const t = setTimeout(() => setSubmitted(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => setShown(STEP), [submitted]);

  const results = useMemo(() => (submitted ? searchQuran(submitted) : null), [submitted]);

  return (
    <Screen back title="البحث في القرآن">
      <Row style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 12 }}>
        <SearchIcon size={18} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
          onSubmitEditing={() => setSubmitted(query.trim())}
          placeholder="اكتب كلمة أو جزءًا من آية"
          placeholderTextColor={colors.mutedForeground}
          style={{ flex: 1, height: 48, color: colors.foreground, fontFamily: "Plex-Regular", fontSize: 16, textAlign: START, writingDirection: "rtl" }}
        />
      </Row>

      {results === null ? (
        <T color="mutedForeground" align="center" style={{ marginTop: 12 }}>
          يُبحث في نص المصحف بالرسم العثماني، فاكتب كما تكتب عادةً.
        </T>
      ) : results.length === 0 ? (
        <T color="mutedForeground" align="center" style={{ marginTop: 12 }}>
          لا نتائج. جرّب كلمة أخرى (حرفان على الأقل).
        </T>
      ) : (
        <>
          <T size={13} color="mutedForeground">
            {n(results.length)} آية
          </T>
          {results.slice(0, shown).map((i) => {
            const a = ayahAt(i);
            return (
              <Pressable key={i} onPress={() => router.push({ pathname: "/mushaf/[page]", params: { page: String(mushafPageOf(i)), ayah: String(i) } })} accessibilityRole="button">
                <Card style={{ gap: 6 }}>
                  <T size={12} weight="semibold" color="primary">
                    سورة {a.surahName} · الآية {n(a.ayah)}
                  </T>
                  <T size={20} style={{ fontFamily: QURAN_FONT, lineHeight: 42 }}>
                    {a.text}
                  </T>
                </Card>
              </Pressable>
            );
          })}
          {results.length > shown ? (
            <View style={{ alignItems: "center" }}>
              <Button label="المزيد" variant="outline" size="sm" onPress={() => setShown(shown + STEP)} />
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
