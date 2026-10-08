/**
 * The mushaf as PDF and the azkar booklet, as the site's /download: the
 * morning/evening booklet (A5, for printing), the whole mushaf, a juz, a
 * surah or a page range, downloaded from the site with progress and opened
 * through the share sheet.
 */
import { useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { BookOpen, ChevronDown, CircleX, Download, Printer } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Button, Card, ListRow, Row, SectionTitle, T } from "@/components/ui";
import { sharePdf } from "@/core/pdf";
import { MUSHAF_PAGES, surahs } from "@/core/quran";
import { START } from "@/theme/rtl";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;
const digits = (s: string) => Number(s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)));

type Job = { key: string; label: string; progress: number };

export default function Pdf() {
  const { colors } = useTheme();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [surahList, setSurahList] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const abort = useRef<AbortController | null>(null);

  const get = async (key: string, path: string, label: string) => {
    if (job) return;
    const ctrl = new AbortController();
    abort.current = ctrl;
    setError(null);
    setJob({ key, label, progress: 0 });
    const r = await sharePdf(path, key, label, (progress) => setJob((j) => (j ? { ...j, progress } : j)), ctrl.signal);
    setJob(null);
    setError(r);
  };

  const a = digits(from);
  const b = digits(to);
  const range = a >= 1 && b >= 1 && a <= MUSHAF_PAGES && b <= MUSHAF_PAGES;
  const input = { flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.muted, paddingHorizontal: 12, color: colors.foreground, fontFamily: "Plex-Regular", fontSize: 15, textAlign: START } as const;

  return (
    <Screen back title="تحميل PDF">
      <T color="mutedForeground">بخط مصحف المدينة النبوية، صفحة بصفحة كما في المصحف المطبوع.</T>

      {job ? (
        <Card style={{ gap: 8 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <T weight="semibold" style={{ flex: 1 }}>
              {job.label}
            </T>
            <T size={13} color="primary">
              {n(Math.round(job.progress * 100))}٪
            </T>
          </Row>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.muted, overflow: "hidden" }}>
            <View style={{ height: 6, width: `${Math.round(job.progress * 100)}%`, backgroundColor: colors.primary }} />
          </View>
          <Button label="إيقاف" icon={CircleX} size="sm" variant="outline" onPress={() => abort.current?.abort()} />
        </Card>
      ) : null}
      {error ? (
        <T size={13} color="destructive">
          {error}
        </T>
      ) : null}

      <Card padded={false} style={{ overflow: "hidden" }}>
        <ListRow
          icon={Printer}
          title="كتيّب أذكار الصباح والمساء"
          note="PDF بمقاس A5 للطباعة والتوزيع المجاني، من حصن المسلم"
          onPress={() => void get("booklet", "/booklet.pdf", "كتيّب أذكار الصباح والمساء")}
          trailing={<Download size={18} color={colors.primary} />}
        />
        <ListRow
          icon={BookOpen}
          title="المصحف كاملًا"
          note={`${n(MUSHAF_PAGES)} صفحة في ملف واحد (حجمه كبير؛ يُفضّل واي فاي)`}
          onPress={() => void get("mushaf", "/mushaf.pdf", "المصحف كاملًا")}
          trailing={<Download size={18} color={colors.primary} />}
          last
        />
      </Card>

      <SectionTitle>الأجزاء</SectionTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
          <Pressable
            key={j}
            onPress={() => void get(`juz-${j}`, `/pdf/juz-${j}.pdf`, `الجزء ${n(j)}`)}
            accessibilityRole="button"
            accessibilityLabel={`الجزء ${n(j)}`}
            style={({ pressed }) => ({ width: "18%", flexGrow: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.muted : colors.card, alignItems: "center" })}
          >
            <T weight="semibold">{n(j)}</T>
          </Pressable>
        ))}
      </View>

      <SectionTitle>صفحات من … إلى …</SectionTitle>
      <Row>
        <TextInput value={from} onChangeText={setFrom} keyboardType="number-pad" placeholder="من" placeholderTextColor={colors.mutedForeground} style={input} />
        <TextInput value={to} onChangeText={setTo} keyboardType="number-pad" placeholder="إلى" placeholderTextColor={colors.mutedForeground} style={input} />
        <Button
          label="تحميل"
          size="sm"
          disabled={!range}
          onPress={() => void get(`pages-${Math.min(a, b)}-${Math.max(a, b)}`, `/pdf/pages-${Math.min(a, b)}-${Math.max(a, b)}.pdf`, `الصفحات ${n(Math.min(a, b))}–${n(Math.max(a, b))}`)}
        />
      </Row>

      <SectionTitle>سورة</SectionTitle>
      <Card padded={false} style={{ overflow: "hidden" }}>
        <ListRow title="اختر سورة" onPress={() => setSurahList((v) => !v)} trailing={<ChevronDown size={18} color={colors.mutedForeground} />} last={!surahList} />
        {surahList
          ? surahs().map((s, i, all) => (
              <ListRow
                key={s.n}
                title={`${n(s.n)}. سورة ${s.name}`}
                onPress={() => void get(`surah-${s.n}`, `/pdf/surah-${s.n}.pdf`, `سورة ${s.name}`)}
                trailing={<Download size={16} color={colors.mutedForeground} />}
                last={i === all.length - 1}
              />
            ))
          : null}
      </Card>
    </Screen>
  );
}
