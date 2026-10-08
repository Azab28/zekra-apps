/** The mushaf's index: a page number to go to, the surahs (with their text view when `onText` is given) and the juz. */
import { useState } from "react";
import { TextInput, View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { ayahAt, juzStarts, MUSHAF_PAGES, surahName, surahs } from "@/core/quran";
import { START } from "@/theme/rtl";
import { useTheme } from "@/theme/theme";
import { FileText } from "./icons";
import { Button, IconButton, ListRow, Row, Segmented } from "./ui";

const n = toArabicDigits;

export function MushafIndex({ onGo, onText }: { onGo: (page: number) => void; onText?: (surah: number) => void }) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<"surah" | "juz">("surah");
  const [typed, setTyped] = useState("");
  const list = tab === "surah" ? surahs() : null;
  const toPage = Number(typed.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)));
  return (
    <View style={{ gap: 12 }}>
      <Row>
        <TextInput
          value={typed}
          onChangeText={setTyped}
          keyboardType="number-pad"
          placeholder="رقم الصفحة (١–٦٠٤)"
          placeholderTextColor={colors.mutedForeground}
          onSubmitEditing={() => toPage >= 1 && toPage <= MUSHAF_PAGES && onGo(toPage)}
          style={{ flex: 1, height: 44, borderRadius: 14, backgroundColor: colors.muted, paddingHorizontal: 12, color: colors.foreground, fontFamily: "Plex-Regular", fontSize: 15, textAlign: START }}
        />
        <Button label="اذهب" size="sm" disabled={!(toPage >= 1 && toPage <= MUSHAF_PAGES)} onPress={() => onGo(toPage)} />
      </Row>
      <Segmented
        options={[
          { value: "surah", label: "السور" },
          { value: "juz", label: "الأجزاء" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
        {list
          ? list.map((s, i) => (
              <ListRow
                key={s.n}
                title={`${n(s.n)}. ${s.name}`}
                note={`${s.medinan ? "مدنية" : "مكية"} · ${n(s.ayahCount)} آية · ص ${n(s.page)}`}
                onPress={() => onGo(s.page)}
                last={i === list.length - 1}
                trailing={onText ? <IconButton icon={FileText} label={`سورة ${s.name} نصًا`} onPress={() => onText(s.n)} size={34} tone="plain" /> : undefined}
              />
            ))
          : juzStarts().map((j, i, all) => (
              <ListRow key={j.juz} title={`الجزء ${n(j.juz)}`} note={`ص ${n(j.page)} · ${surahName(ayahAt(j.index).surah)}`} onPress={() => onGo(j.page)} last={i === all.length - 1} />
            ))}
      </View>
    </View>
  );
}
