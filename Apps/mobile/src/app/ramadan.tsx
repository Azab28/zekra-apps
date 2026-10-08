/**
 * Ramadan, as the site's /ramadan: in the month, a countdown to iftar or to
 * the imsak for the saved place, today's fajr and maghrib, and the month's
 * khatma (a juz a day, the juz read kept on this device per year); before it,
 * the days left. The month's timetable (the site's /api/imsakiya) either way.
 */
import { router } from "expo-router";
import { DateTime } from "luxon";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { hijriOf } from "@lib/hijri-core";
import { imsakiyaUrl, type SitePlace } from "@lib/site-prefs";
import { prayerTimesFor } from "@lib/schedule/prayer-calc";
import { BookOpen, Check, HandHeart, MapPin, MoonStar } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Button, Card, Row, T } from "@/components/ui";
import { shareRemoteImage } from "@/core/images";
import { calcPlace, fmtTime } from "@/core/prayer";
import { juzStarts } from "@/core/quran";
import { SITE_URL } from "@/core/site";
import { readJson, writeJson } from "@/core/storage";
import { useStore } from "@/core/store";
import { useNow } from "@/core/use-now";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;

/** «٢:٠٥:٠٩» */
const countdown = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return n(`${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`);
};

export default function Ramadan() {
  const { prefs, hijriOffset } = useStore();
  const now = useNow(1000);
  const place = prefs.place;
  if (!place) {
    return (
      <Screen back title="رمضان">
        <Card style={{ gap: 12, alignItems: "center" }}>
          <T color="mutedForeground" align="center">
            اختر مدينتك لتظهر مواعيد الإفطار والسحور.
          </T>
          <Button label="اختيار المدينة" icon={MapPin} onPress={() => router.navigate("/prayer")} />
        </Card>
      </Screen>
    );
  }
  const today = DateTime.fromMillis(now).setZone(place.timezone);
  const h = hijriOf(today, hijriOffset);
  return (
    <Screen back title="رمضان">
      {h.month === 9 ? <InRamadan place={place} now={now} today={today} day={h.day} year={h.year} /> : <BeforeRamadan today={today} hijriOffset={hijriOffset} />}
      <Imsakiya place={place} label={h.month === 9 ? "إمساكية الشهر كاملًا" : "إمساكية رمضان لمدينتك"} />
    </Screen>
  );
}

function InRamadan({ place, now, today, day, year }: { place: SitePlace; now: number; today: DateTime; day: number; year: number }) {
  const { colors } = useTheme();
  const { settings } = useStore();
  const p = calcPlace(place, settings.madhab);
  const t = prayerTimesFor(today.startOf("day"), p);
  const tomorrowFajr = prayerTimesFor(today.startOf("day").plus({ days: 1 }), p).fajr;
  const fasting = now >= t.fajr.getTime() && now < t.maghrib.getTime();
  const next = fasting
    ? { label: "الإفطار بعد", at: t.maghrib, note: `أذان المغرب ${fmtTime(t.maghrib, place.timezone)}` }
    : { label: "الإمساك بعد", at: now < t.fajr.getTime() ? t.fajr : tomorrowFajr, note: "الإمساك عند أذان الفجر" };
  const juz = Math.min(day, 30);
  const [read, setRead] = useState<number[]>([]);
  const key = `ramadan-read:${year}`;

  useEffect(() => {
    void readJson<number[]>(key).then((v) => setRead(Array.isArray(v) ? v : []));
  }, [key]);
  const toggle = (d: number) => {
    const next = read.includes(d) ? read.filter((x) => x !== d) : [...read, d];
    setRead(next);
    void writeJson(key, next);
  };

  return (
    <>
      <View style={{ backgroundColor: colors.primary, borderRadius: 24, padding: 20, alignItems: "center", gap: 4 }}>
        <T size={13} color={colors.primaryForeground} align="center" style={{ opacity: 0.85 }}>
          {place.city} · اليوم {n(day)} من رمضان {n(year)}هـ{day >= 21 ? " · العشر الأواخر" : ""}
        </T>
        <T size={14} weight="semibold" color={colors.primaryForeground} style={{ marginTop: 8 }}>
          {next.label}
        </T>
        <T size={44} weight="bold" color={colors.primaryForeground} align="center">
          {countdown(next.at.getTime() - now)}
        </T>
        <T size={13} color={colors.primaryForeground} style={{ opacity: 0.85 }}>
          {next.note}
        </T>
        {!fasting && now >= t.maghrib.getTime() ? (
          <T size={14} color={colors.primaryForeground}>
            تقبّل الله صيامكم
          </T>
        ) : null}
      </View>

      <Row gap={10}>
        <Card style={{ flex: 1, alignItems: "center" }}>
          <T size={12} color="mutedForeground">
            الإمساك (الفجر)
          </T>
          <T size={22} weight="bold">
            {fmtTime(t.fajr, place.timezone)}
          </T>
        </Card>
        <Card style={{ flex: 1, alignItems: "center" }}>
          <T size={12} color="mutedForeground">
            الإفطار (المغرب)
          </T>
          <T size={22} weight="bold">
            {fmtTime(t.maghrib, place.timezone)}
          </T>
        </Card>
      </Row>

      <Card style={{ gap: 12 }}>
        <View>
          <T weight="bold">ختمة رمضان: جزء كل يوم</T>
          <T size={13} color="mutedForeground">
            وِرد اليوم: الجزء {n(juz)} · قرأت {n(read.length)} من ٣٠
          </T>
        </View>
        <Button
          label={`اقرأ الجزء ${n(juz)}`}
          icon={BookOpen}
          onPress={() => router.push({ pathname: "/mushaf/[page]", params: { page: String(juzStarts()[juz - 1]?.page ?? 1) } })}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => {
            const done = read.includes(d);
            return (
              <Pressable
                key={d}
                onPress={() => toggle(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: done }}
                accessibilityLabel={`الجزء ${d}${done ? " (تمت قراءته)" : ""}`}
                style={{
                  width: "15%",
                  aspectRatio: 1,
                  borderRadius: 10,
                  borderWidth: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  borderColor: done || d === juz ? colors.primary : colors.border,
                  backgroundColor: done ? colors.primary : colors.card,
                }}
              >
                {done ? (
                  <Check size={16} color={colors.primaryForeground} />
                ) : (
                  <T size={13} color={d === juz ? "primary" : "foreground"}>
                    {n(d)}
                  </T>
                )}
              </Pressable>
            );
          })}
        </View>
        <T size={12} color="mutedForeground">
          اضغط رقم الجزء عند إتمامه. يُحفظ على هذا الجهاز.
        </T>
      </Card>

      <Button label="دعاء الإفطار" icon={HandHeart} variant="outline" onPress={() => router.push({ pathname: "/azkar/[slug]", params: { slug: "68" } })} />
    </>
  );
}

function BeforeRamadan({ today, hijriOffset }: { today: DateTime; hijriOffset: number }) {
  const { colors } = useTheme();
  let days = 0;
  let start = today.startOf("day");
  for (; days < 400; days++, start = start.plus({ days: 1 })) {
    const h = hijriOf(start, hijriOffset);
    if (h.month === 9 && h.day === 1) break;
  }
  const date = new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(start.year, start.month - 1, start.day, 12)));
  return (
    <Card style={{ gap: 10, alignItems: "center" }}>
      <MoonStar size={40} color={colors.gold} />
      <T size={18} weight="bold" align="center">
        {days === 0 ? "رمضان يبدأ اليوم" : days === 1 ? "رمضان يبدأ غدًا" : `باقي ${n(days)} يومًا على رمضان`}
      </T>
      <T size={14} color="mutedForeground" align="center">
        أول رمضان المتوقع: {date} (حسب تقويم أم القرى، وقد يختلف يومًا حسب رؤية الهلال).
      </T>
      <T size={14} color="mutedForeground" align="center">
        في رمضان تظهر هنا مواعيد الإفطار والسحور بالعدّ التنازلي، وجزء كل يوم لختمة الشهر.
      </T>
    </Card>
  );
}

/** The month's timetable as an image (the site's /api/imsakiya for this place and its adjustments). */
function Imsakiya({ place, label }: { place: SitePlace; label: string }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={{ gap: 6 }}>
      <Button
        label={busy ? "جارٍ التجهيز…" : label}
        icon={MoonStar}
        variant="outline"
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          setError(null);
          setError(await shareRemoteImage(SITE_URL + imsakiyaUrl(place), "imsakiya", `إمساكية رمضان — ${place.city}`, false));
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
