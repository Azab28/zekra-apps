/** Home: the date, the next prayer, the ayah of the day and every section, over the mosque scene. */
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { ChevronLeft, MapPin, Settings, UserRound, UserRoundCheck } from "@/components/icons";
import { Logo } from "@/components/logo";
import { PollCard } from "@/components/poll-card";
import { Screen } from "@/components/screen";
import { SectionGrid } from "@/components/section-grid";
import { Button, Card, IconButton, Row, T } from "@/components/ui";
import { hijriText } from "@/core/hijri";
import { calcPlace, dateLine, dayAt, deviceZone, fmtTime, nextPrayer, untilPhrase } from "@/core/prayer";
import { ayahAt, ayahOfTheDay } from "@/core/quran";
import { SECTIONS } from "@/core/sections";
import { useStore } from "@/core/store";
import { useNow } from "@/core/use-now";
import { QURAN_FONT } from "@/theme/fonts";
import { useTheme } from "@/theme/theme";

export default function Home() {
  const { prefs, settings, hijriOffset, user } = useStore();
  const { colors } = useTheme();
  const now = useNow();
  const place = prefs.place;
  const zone = place?.timezone ?? deviceZone() ?? "UTC";
  const today = dayAt(zone, now);
  const hijri = hijriText(today, hijriOffset);
  const next = place ? nextPrayer(calcPlace(place, settings.madhab), now) : null;

  return (
    <Screen
      tab
      scene="home"
      header={
        <Row style={{ justifyContent: "space-between", minHeight: 52, marginBottom: 4 }}>
          <Logo height={40} />
          <Row gap={6}>
            <IconButton icon={user ? UserRoundCheck : UserRound} label={user ? "حسابك" : "تسجيل الدخول"} onPress={() => router.push("/account")} tone={user ? "primary" : "muted"} />
            <IconButton icon={Settings} label="الإعدادات" onPress={() => router.push("/settings")} />
          </Row>
        </Row>
      }
    >
      <View style={{ paddingVertical: 10 }}>
        <T size={26} weight="bold">
          {hijri ?? dateLine(today)}
        </T>
        {hijri ? (
          <T size={15} color="mutedForeground">
            {dateLine(today)}
          </T>
        ) : null}
      </View>

      {next && place ? (
        <Pressable onPress={() => router.navigate("/prayer")} accessibilityRole="button">
          <View style={{ backgroundColor: colors.primary, borderRadius: 24, padding: 18, gap: 4 }}>
            <Row gap={6}>
              <MapPin size={14} color={colors.primaryForeground} />
              <T size={13} color={colors.primaryForeground} style={{ opacity: 0.85 }}>
                {place.city} · الصلاة القادمة
              </T>
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              <T size={24} weight="bold" color={colors.primaryForeground}>
                {next.label}
              </T>
              <T size={22} weight="semibold" color={colors.primaryForeground}>
                {fmtTime(next.at, place.timezone)}
              </T>
            </Row>
            <T size={14} color={colors.primaryForeground} style={{ opacity: 0.9 }}>
              بعد {untilPhrase(Math.max(0, Math.round((next.at.getTime() - now) / 60_000)))}
            </T>
          </View>
        </Pressable>
      ) : (
        <Card style={{ gap: 10 }}>
          <T weight="semibold">مواقيت الصلاة لمدينتك</T>
          <T size={14} color="mutedForeground">
            اختر مدينتك أو حدّد موقعك لتظهر الصلاة القادمة هنا وتصلك تنبيهات الأذان.
          </T>
          <Button label="اختر مدينتك" icon={MapPin} onPress={() => router.navigate("/prayer")} />
        </Card>
      )}

      <AyahOfTheDay />

      <PollCard />

      <SectionGrid sections={SECTIONS.filter((s) => s.id !== "prayer")} />
    </Screen>
  );
}

/** «آية اليوم», as on the site's home page; a tap opens it in its surah with the tafsir. */
function AyahOfTheDay() {
  const { colors } = useTheme();
  const ayat = ayahOfTheDay().map(ayahAt);
  const first = ayat[0];
  const last = ayat[ayat.length - 1];
  const ref = `سورة ${first.surahName} ${first.ayah === last.ayah ? toArabicDigits(first.ayah) : `${toArabicDigits(first.ayah)}–${toArabicDigits(last.ayah)}`}`;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/surah/[n]", params: { n: String(first.surah), ayah: String(first.ayah) } })}
      accessibilityRole="button"
      accessibilityLabel={`آية اليوم: ${ref}`}
    >
      <Card style={{ gap: 8, alignItems: "center" }}>
        <T size={13} weight="semibold" color="primary">
          آية اليوم
        </T>
        <T size={22} align="center" style={{ fontFamily: QURAN_FONT, lineHeight: 46 }}>
          ﴿ {ayat.map((a) => a.text).join(" ")} ﴾
        </T>
        <Row gap={6}>
          <T size={13} color="mutedForeground">
            [{ref}]
          </T>
          <T size={13} color="primary">
            · التفسير
          </T>
          <ChevronLeft size={14} color={colors.primary} />
        </Row>
      </Card>
    </Pressable>
  );
}
