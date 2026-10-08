/** Prayer times: today or tomorrow for the saved place, the next prayer, the place, method, madhab and minute settings, the prayer log, and the times or the Ramadan timetable as an image. */
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { daysToRamadan } from "@lib/hijri-core";
import { DEFAULT_PRAYER_CARD_STYLE, PRAYER_CARD_STYLE_IDS, PRAYER_CARD_STYLES, type PrayerCardStyleId } from "@lib/prayer-card-styles";
import { PRAYER_INFO, SUNRISE_NOTE } from "@lib/prayer-info";
import { CALC_METHODS, isCalcMethod, MAX_ADJUST_MINUTES, PRAYER_LABELS, PRAYER_NAMES, prayerTimesFor } from "@lib/schedule/prayer-calc";
import { toArabicDigits } from "@lib/content/arabic";
import { imsakiyaUrl, prayerCardUrl, type SitePlace } from "@lib/site-prefs";
import type { PrayerName } from "@lib/types";
import { CityPicker, useLocate } from "@/components/city-picker";
import { AlarmClock, BellRing, Check, Image as ImageIcon, ListChecks, LocateFixed, MapPin, Minus, MoonStar, Plus, SlidersHorizontal, Table, Timer } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Sheet } from "@/components/sheet";
import { Button, Card, IconButton, ListRow, Row, Segmented, SectionTitle, T } from "@/components/ui";
import { hijriText } from "@/core/hijri";
import { calcPlace, dateLine, dayAt, fmtTime, ORDER, prayerLabel, untilPhrase } from "@/core/prayer";
import { shareRemoteImage } from "@/core/images";
import { notificationsSupported } from "@/core/notifications";
import { SITE_URL } from "@/core/site";
import { useStore } from "@/core/store";
import { useNow } from "@/core/use-now";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;

export default function PrayerScreen() {
  const { prefs } = useStore();
  const [picking, setPicking] = useState(false);
  return (
    <Screen tab title="مواقيت الصلاة">
      {prefs.place ? <Times place={prefs.place} onChangePlace={() => setPicking(true)} /> : <NoPlace onPick={() => setPicking(true)} />}
      <CityPicker open={picking} onClose={() => setPicking(false)} />
    </Screen>
  );
}

function NoPlace({ onPick }: { onPick: () => void }) {
  const { locate, busy, error } = useLocate();
  return (
    <Card style={{ gap: 12 }}>
      <T size={17} weight="bold">
        أين تصلّي؟
      </T>
      <T color="mutedForeground">تُحسب المواقيت على جهازك من موقعك أو من مدينة تختارها، ولا يُرسل موقعك إلى أي مكان.</T>
      <Button label={busy ? "جارٍ تحديد موقعك…" : "حدّد موقعي"} icon={LocateFixed} disabled={busy} onPress={() => void locate()} />
      <Button label="اختر مدينة من القائمة" icon={MapPin} variant="outline" onPress={onPick} />
      {error ? (
        <T size={13} color="destructive">
          {error}
        </T>
      ) : null}
    </Card>
  );
}

function Times({ place, onChangePlace }: { place: SitePlace; onChangePlace: () => void }) {
  const { settings, updateSettings, hijriOffset, dispatch } = useStore();
  const { colors } = useTheme();
  const now = useNow();
  const [ahead, setAhead] = useState(0);
  const [info, setInfo] = useState<PrayerName | null>(null);
  const [sheet, setSheet] = useState<"method" | "adjust" | "card" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const p = calcPlace(place, settings.madhab);
  const day = dayAt(place.timezone, now, ahead);
  const times = prayerTimesFor(day, p);
  const hijri = hijriText(day, hijriOffset);

  // The next prayer (sunrise isn't one) and how long until it, on today's page.
  const upcoming = ahead === 0 ? ORDER.filter((k) => k !== "sunrise").find((k) => times[k].getTime() > now) : undefined;
  const nextAt = upcoming ? times[upcoming] : prayerTimesFor(dayAt(place.timezone, now, 1), p).fajr;
  const nextLabel = upcoming ? prayerLabel(upcoming, day) : PRAYER_LABELS.fajr;
  const minutes = Math.max(0, Math.round((nextAt.getTime() - now) / 60_000));
  // The imsakiya only in Ramadan and the 15 days before it (as the site's /prayer; the Ramadan page has it all year).
  const imsakiya = daysToRamadan(dayAt(place.timezone, now), hijriOffset) <= 15;

  /** The site draws them (/api/prayer-card, /api/imsakiya) for this place and its minute adjustments. */
  const share = async (what: "imsakiya" | PrayerCardStyleId) => {
    setSheet(null);
    setBusy(true);
    setError(null);
    const url = SITE_URL + (what === "imsakiya" ? imsakiyaUrl(place) : prayerCardUrl(place, what === DEFAULT_PRAYER_CARD_STYLE ? undefined : what));
    setError(await shareRemoteImage(url, what === "imsakiya" ? "imsakiya" : `prayer-card-${what}`, what === "imsakiya" ? `إمساكية رمضان — ${place.city}` : `مواقيت الصلاة — ${place.city}`, false));
    setBusy(false);
  };

  return (
    <>
      <Card style={{ gap: 12 }}>
        <Row style={{ justifyContent: "space-between" }} align="flex-start">
          <View style={{ flex: 1 }}>
            <Row gap={6}>
              <MapPin size={16} color={colors.primary} />
              <T size={17} weight="bold" lines={1} style={{ flexShrink: 1 }}>
                {place.city}
              </T>
            </Row>
            <T size={13} color="mutedForeground">
              {ahead === 1 ? "غدًا — " : ""}
              {dateLine(day)}
            </T>
            {hijri ? (
              <T size={13} color="mutedForeground">
                {hijri}
              </T>
            ) : null}
          </View>
          <Button label="تغيير" size="sm" variant="outline" onPress={onChangePlace} />
        </Row>

        {ahead === 0 && (
          <View style={{ backgroundColor: colors.primary, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 }}>
            <T size={12} color={colors.primaryForeground} style={{ opacity: 0.85 }}>
              الصلاة القادمة
            </T>
            <T size={19} weight="bold" color={colors.primaryForeground}>
              {nextLabel} — بعد {untilPhrase(minutes)}
            </T>
          </View>
        )}

        <Segmented
          options={[
            { value: 0, label: "اليوم" },
            { value: 1, label: "غدًا" },
          ]}
          value={ahead}
          onChange={setAhead}
        />

        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          {ORDER.map((k, i) => {
            const isNext = k === upcoming;
            return (
              <Pressable
                key={k}
                onPress={() => setInfo(k)}
                accessibilityRole="button"
                accessibilityHint="تفاصيل الصلاة"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 16,
                  paddingVertical: 13,
                  borderBottomWidth: i === ORDER.length - 1 ? 0 : 1,
                  borderBottomColor: colors.border,
                  backgroundColor: isNext ? colors.accent : pressed ? colors.muted : "transparent",
                  opacity: k === "sunrise" ? 0.75 : 1,
                })}
              >
                <T weight={isNext ? "bold" : "medium"} color={isNext ? "primary" : "foreground"}>
                  {prayerLabel(k, day)}
                </T>
                <T size={16} weight={isNext ? "bold" : "medium"} color={isNext ? "primary" : "foreground"}>
                  {fmtTime(times[k], place.timezone)}
                </T>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <SectionTitle>الحساب والتنبيهات</SectionTitle>
      <Card padded={false} style={{ overflow: "hidden" }}>
        <ListRow icon={BellRing} title="تنبيه الأذان" note={!notificationsSupported() ? "يحتاج نسخة التطوير" : settings.adhan.enabled ? "مفعّل على هذا الجهاز" : "متوقف"} onPress={() => router.push("/adhan")} />
        <ListRow icon={AlarmClock} title="التذكيرات" note="الذكر، والكهف، ومنبّه القرآن، والمناسبات" onPress={() => router.push("/reminders")} />
        <ListRow icon={SlidersHorizontal} title="طريقة الحساب" note={CALC_METHODS[isCalcMethod(place.calcMethod) ? place.calcMethod : "Egyptian"].label} onPress={() => setSheet("method")} />
        <ListRow icon={Timer} title="تعديل المواعيد بالدقائق" note={adjustNote(place)} onPress={() => setSheet("adjust")} />
        <ListRow icon={Table} title="جدول الشهر" onPress={() => router.push("/prayer-month")} />
        <ListRow icon={ListChecks} title="سجل الصلوات" note="صليت في الوقت أم بعده، وأيامك المتتالية" onPress={() => router.push("/salat")} />
        <ListRow icon={ImageIcon} title="صورة المواقيت" note="مواقيت اليوم صورةً للمشاركة" onPress={() => setSheet("card")} last={!imsakiya} />
        {imsakiya ? <ListRow icon={MoonStar} title="إمساكية رمضان" note="جدول الشهر صورةً لمدينتك" onPress={() => void share("imsakiya")} last /> : null}
      </Card>
      {busy ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? (
        <T size={13} color="destructive">
          {error}
        </T>
      ) : null}
      <View style={{ gap: 6 }}>
        <SectionTitle>مذهب العصر</SectionTitle>
        <Segmented
          options={[
            { value: "shafi", label: "الجمهور (الشافعي)" },
            { value: "hanafi", label: "الحنفي" },
          ]}
          value={settings.madhab}
          onChange={(madhab) => updateSettings((s) => ({ ...s, madhab }))}
        />
      </View>

      <Sheet open={info !== null} onClose={() => setInfo(null)} title={info ? `صلاة ${prayerLabel(info, day)}` : ""}>
        {info && <PrayerInfoView name={info} friday={day.weekday === 5} />}
      </Sheet>

      <Sheet open={sheet === "method"} onClose={() => setSheet(null)} title="طريقة الحساب">
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          {Object.entries(CALC_METHODS).map(([key, m], i, all) => (
            <ListRow
              key={key}
              title={m.label}
              last={i === all.length - 1}
              onPress={() => {
                dispatch({ type: "place", ...place, calcMethod: key });
                setSheet(null);
              }}
              trailing={place.calcMethod === key ? <Check size={18} color={colors.primary} /> : <View />}
            />
          ))}
        </View>
      </Sheet>

      <Sheet open={sheet === "card"} onClose={() => setSheet(null)} title="صورة المواقيت">
        <View style={{ gap: 10 }}>
          <T size={14} color="mutedForeground">
            اختر شكل الصورة:
          </T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {PRAYER_CARD_STYLE_IDS.map((id) => {
              const look = PRAYER_CARD_STYLES[id];
              return (
                <Pressable key={id} onPress={() => void share(id)} accessibilityRole="button" accessibilityLabel={look.label} style={{ width: "30%", flexGrow: 1, alignItems: "center", gap: 6 }}>
                  <View style={{ width: "100%", height: 56, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: look.theme.bg[look.theme.bg.length - 1], alignItems: "center", justifyContent: "center" }}>
                    <T size={13} weight="bold" color={look.theme.accent}>
                      {PRAYER_LABELS.fajr}
                    </T>
                  </View>
                  <T size={12} align="center">
                    {look.label}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Sheet>

      <Sheet open={sheet === "adjust"} onClose={() => setSheet(null)} title="تعديل المواعيد بالدقائق">
        <AdjustView place={place} />
      </Sheet>
    </>
  );
}

const adjustNote = (place: SitePlace) => {
  const a = place.prayerAdjust;
  const parts = PRAYER_NAMES.filter((k) => a?.[k]).map((k) => `${PRAYER_LABELS[k]} ${(a![k]! > 0 ? "+" : "−") + n(Math.abs(a![k]!))}`);
  return parts.length ? parts.join("، ") : "لتوافق مسجدك (±٣٠ دقيقة)";
};

function AdjustView({ place }: { place: SitePlace }) {
  const { dispatch } = useStore();
  const { colors } = useTheme();
  const adjust = place.prayerAdjust ?? {};
  const set = (k: PrayerName, v: number) => dispatch({ type: "adjust", prayerAdjust: { ...adjust, [k]: Math.max(-MAX_ADJUST_MINUTES, Math.min(MAX_ADJUST_MINUTES, v)) } });
  return (
    <View style={{ gap: 10 }}>
      <T size={14} color="mutedForeground">
        أضف دقائق أو أنقصها من كل صلاة لتطابق أذان مسجدك. تُطبَّق على المواقيت والتنبيهات.
      </T>
      {PRAYER_NAMES.map((k) => {
        const v = adjust[k] ?? 0;
        return (
          <Row key={k} style={{ justifyContent: "space-between", paddingVertical: 4 }}>
            <T weight="medium" style={{ flex: 1 }}>
              {PRAYER_LABELS[k]}
            </T>
            <Row gap={12}>
              <IconButton icon={Plus} label={`زيادة ${PRAYER_LABELS[k]}`} onPress={() => set(k, v + 1)} disabled={v >= MAX_ADJUST_MINUTES} />
              <T size={17} weight="bold" align="center" color={v ? "primary" : "mutedForeground"} style={{ minWidth: 44 }}>
                {v === 0 ? "٠" : `${v > 0 ? "+" : "−"}${n(Math.abs(v))}`}
              </T>
              <IconButton icon={Minus} label={`إنقاص ${PRAYER_LABELS[k]}`} onPress={() => set(k, v - 1)} disabled={v <= -MAX_ADJUST_MINUTES} />
            </Row>
          </Row>
        );
      })}
      <Button label="إلغاء كل التعديلات" variant="outline" disabled={!place.prayerAdjust} onPress={() => dispatch({ type: "adjust", prayerAdjust: null })} style={{ marginTop: 6, borderColor: colors.border }} />
    </View>
  );
}

function PrayerInfoView({ name, friday }: { name: PrayerName; friday: boolean }) {
  if (name === "sunrise") return <T>{SUNRISE_NOTE}</T>;
  const info = PRAYER_INFO[name === "dhuhr" && friday ? "jumuah" : name];
  const rows: [string, string][] = [
    ["عدد الركعات", info.rakaat],
    ["القراءة", info.recitation],
    ["السنة قبلها", info.before],
    ["السنة بعدها", info.after],
  ];
  return (
    <View style={{ gap: 12 }}>
      {rows.map(([label, value]) => (
        <View key={label}>
          <T size={13} color="mutedForeground">
            {label}
          </T>
          <T weight="medium">{value}</T>
        </View>
      ))}
      {info.note ? (
        <T size={14} color="mutedForeground">
          {info.note}
        </T>
      ) : null}
    </View>
  );
}
