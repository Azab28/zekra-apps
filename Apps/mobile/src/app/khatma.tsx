/** A personal khatma as on the site (/khatma): pages a day, today's wird in the mushaf, progress and finished khatmas — through the site's `khatma` action. */
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { pageInfo } from "@lib/content/mushaf-pages";
import { KHATMA_DAILY_OPTIONS } from "@lib/tasbeeh";
import { BookOpen, Check, Flame, Image as ImageIcon, Medal, RotateCcw, Settings2, Sparkles } from "@/components/icons";
import { MemorialAsk } from "@/components/memorial-ask";
import { Screen } from "@/components/screen";
import { useDialogs } from "@/components/sheet";
import { Button, Card, Row, T } from "@/components/ui";
import { todayIn } from "@/core/day";
import { shareRemoteImage } from "@/core/images";
import { SITE_URL } from "@/core/site";
import { MUSHAF_PAGES as PAGES } from "@/core/quran";
import { useStore } from "@/core/store";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;
const pagesPhrase = (x: number) => (x === 1 ? "صفحة واحدة" : x === 2 ? "صفحتان" : x <= 10 ? `${n(x)} صفحات` : `${n(x)} صفحة`);
const streakPhrase = (d: number) => (d === 1 ? "يوم واحد" : d === 2 ? "يومان متتاليان" : `${n(d)} ${d <= 10 ? "أيام" : "يومًا"} متتالية`);
const daysPhrase = (d: number) => (d === 1 ? "يوم واحد" : d === 2 ? "يومان" : d <= 10 ? `${n(d)} أيام` : `${n(d)} يومًا`);

export default function Khatma() {
  const { prefs, dispatch } = useStore();
  const { colors } = useTheme();
  const dialogs = useDialogs();
  const [choosing, setChoosing] = useState(false);
  const [finished, setFinished] = useState<{ n: number; from: string | null; to: string } | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const k = prefs.khatma;
  const today = todayIn(prefs.place?.timezone);

  if (!k.page || choosing) {
    return (
      <Screen back title="ختمتي">
        <Card style={{ gap: 12 }}>
          <T size={17} weight="bold">
            كم صفحة تقرأ كل يوم؟
          </T>
          <T size={14} color="mutedForeground">
            اختر وردك اليومي؛ تحته مدة الختمة.
          </T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {KHATMA_DAILY_OPTIONS.map((d) => {
              const on = !!k.page && k.daily === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => {
                    dispatch({ type: "khatma", daily: d, day: today });
                    setChoosing(false);
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    width: "48%",
                    flexGrow: 1,
                    borderRadius: 16,
                    borderWidth: on ? 2 : 1,
                    borderColor: on ? colors.primary : colors.border,
                    backgroundColor: pressed ? colors.muted : colors.card,
                    padding: 14,
                  })}
                >
                  <T weight="semibold">{pagesPhrase(d)}</T>
                  <T size={12} color="mutedForeground">
                    ختمة في {daysPhrase(Math.ceil(PAGES / d))}
                  </T>
                </Pressable>
              );
            })}
          </View>
          {k.page ? <Button label="إلغاء" variant="ghost" onPress={() => setChoosing(false)} /> : null}
        </Card>
      </Screen>
    );
  }

  const from = k.page;
  const to = Math.min(from + k.daily - 1, PAGES);
  const read = from - 1;
  const doneToday = k.day === today;
  const left = Math.ceil((PAGES - read) / k.daily);
  const percent = Math.floor((read / PAGES) * 100);

  const markDone = () => {
    const finishing = from + k.daily > PAGES;
    const started = k.started ?? null;
    dispatch({ type: "khatma", done: true, day: today });
    if (finishing) setFinished({ n: k.done + 1, from: started, to: today });
  };

  const restart = async () => {
    const ok = await dialogs.confirm({ title: "ختمة جديدة؟", message: "تبدأ من الصفحة الأولى، وتبقى الختمات المكتملة محفوظة.", confirm: "ابدأ من جديد" });
    if (ok) dispatch({ type: "khatma", restart: true, day: today });
  };

  return (
    <Screen back title="ختمتي">
      {finished != null ? (
        <Card style={{ alignItems: "center", gap: 10, paddingVertical: 22 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
            <Medal size={32} color={colors.gold} />
          </View>
          <T size={19} weight="bold" align="center">
            أتممت الختمة {n(finished.n)}، تقبّل الله منك
          </T>
          <MemorialAsk />
          <Row>
            <Button
              label={cardBusy ? "جارٍ التجهيز…" : "صورة الختمة"}
              icon={ImageIcon}
              size="sm"
              disabled={cardBusy}
              onPress={async () => {
                // The site's card (/api/khatma-card): the khatma's number and its days.
                setCardBusy(true);
                const q = new URLSearchParams({ n: String(finished.n), to: finished.to, ...(finished.from ? { from: finished.from } : {}) });
                setCardError(await shareRemoteImage(`${SITE_URL}/api/khatma-card?${q}`, `khatma-${finished.n}`, "أتممت ختمة القرآن الكريم", false));
                setCardBusy(false);
              }}
            />
            <Button label="حسنًا" size="sm" variant="outline" onPress={() => setFinished(null)} />
          </Row>
          {cardError ? (
            <T size={13} color="destructive">
              {cardError}
            </T>
          ) : null}
        </Card>
      ) : null}

      <Card style={{ gap: 10 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <T size={13} color="mutedForeground">
            {doneToday ? "وردك القادم" : "وردك اليوم"}
          </T>
          {/* Days in a row with a wird: from the account (signed in only). */}
          {prefs.streak && prefs.streak.days > 0 ? (
            <Row gap={4} style={{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Flame size={14} color={colors.gold} />
              <T size={12} weight="semibold">
                {streakPhrase(prefs.streak.days)}
              </T>
            </Row>
          ) : null}
        </Row>
        <T size={24} weight="bold">
          الصفحات {n(from)}–{n(to)}
        </T>
        <T size={13} color="mutedForeground">
          الجزء {n(pageInfo(from).juz)}
        </T>

        <View style={{ gap: 6, marginTop: 6 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <T size={12} color="mutedForeground">
              {n(read)} من {n(PAGES)} صفحة
            </T>
            <T size={12} color="mutedForeground">
              {n(percent)}٪
            </T>
          </Row>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.muted, overflow: "hidden" }}>
            <View style={{ height: 10, width: `${(read / PAGES) * 100}%`, backgroundColor: colors.primary }} />
          </View>
          <T size={12} color="mutedForeground">
            يتبقى نحو {daysPhrase(left)} بمعدل {pagesPhrase(k.daily)} يوميًا
          </T>
        </View>

        {doneToday ? (
          <Row gap={8} style={{ backgroundColor: colors.accent, borderRadius: 12, padding: 12 }}>
            <Sparkles size={16} color={colors.primary} />
            <T size={14} color="primary" style={{ flex: 1 }}>
              أنهيت ورد اليوم، تقبّل الله منك.
            </T>
          </Row>
        ) : null}

        <Button label="افتح الورد في المصحف" icon={BookOpen} onPress={() => router.push({ pathname: "/mushaf/[page]", params: { page: String(from) } })} />
        <Button label="أنهيت الورد" icon={Check} variant="outline" onPress={markDone} />
      </Card>

      <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        {k.done > 0 ? (
          <Row gap={6}>
            <Medal size={16} color={colors.gold} />
            <T size={14}>ختمات مكتملة: {n(k.done)}</T>
          </Row>
        ) : (
          <View />
        )}
        <Row>
          <Button label="تغيير الورد" icon={Settings2} variant="outline" size="sm" onPress={() => setChoosing(true)} />
          <Button label="من جديد" icon={RotateCcw} variant="outline" size="sm" onPress={() => void restart()} />
        </Row>
      </Row>
    </Screen>
  );
}
