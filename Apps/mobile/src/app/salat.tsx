/**
 * The prayer log, as the site's /salat: today's five prayers (a tap: on time →
 * later → cleared; prayers not yet due are locked), the last 30 days in
 * numbers, and each of those days.
 */
import { router } from "expo-router";
import { DateTime } from "luxon";
import { Pressable, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { toArabicDigits } from "@lib/content/arabic";
import { PRAYER_LABELS, prayerTimesFor } from "@lib/schedule/prayer-calc";
import { Check, Clock, Flame, Lock, MapPin } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Card, Row, T } from "@/components/ui";
import { todayIn } from "@/core/day";
import { calcPlace, fmtTime } from "@/core/prayer";
import { completeDay, LOG_PRAYERS, usePrayerLog, type LogPrayer, type LogStatus } from "@/core/prayer-log";
import { useStore } from "@/core/store";
import { useNow } from "@/core/use-now";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;
const DAYS = 30;
const LATE = "#d97706";
const dayLabel = (d: DateTime) => new Intl.DateTimeFormat("ar-EG", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(d.year, d.month - 1, d.day, 12)));

export default function Salat() {
  const { prefs, settings } = useStore();
  const { colors } = useTheme();
  const now = useNow();
  const zone = prefs.place?.timezone ?? null;
  const today = todayIn(zone);
  const from = DateTime.fromISO(today).minus({ days: DAYS - 1 }).toISODate()!;
  const { marks, synced, toggle } = usePrayerLog(from, today);

  const days = Array.from({ length: DAYS }, (_, i) => DateTime.fromISO(today).minus({ days: i }));
  let ontime = 0;
  let late = 0;
  let full = 0;
  let streak = 0;
  if (marks) {
    for (const d of days) {
      const iso = d.toISODate()!;
      for (const s of Object.values(marks[iso] ?? {})) {
        if (s === "ontime") ontime++;
        else if (s === "late") late++;
      }
      if (completeDay(marks, iso)) full++;
    }
    for (let i = completeDay(marks, today) ? 0 : 1; i < DAYS && completeDay(marks, days[i].toISODate()!); i++) streak++;
  }
  const times = prefs.place ? prayerTimesFor(DateTime.fromISO(today, { zone: prefs.place.timezone }), calcPlace(prefs.place, settings.madhab)) : null;
  const doneToday = marks ? LOG_PRAYERS.filter((p) => marks[today]?.[p]).length : 0;

  return (
    <Screen back title="سجل الصلوات">
      <Card style={{ gap: 14 }}>
        <Row gap={14}>
          <Ring value={doneToday} />
          <View style={{ flex: 1 }}>
            <T size={17} weight="bold">
              صلوات اليوم
            </T>
            <T size={13} color="mutedForeground">
              {doneToday === 5 ? "أتممت صلوات اليوم، تقبّل الله منك" : "اضغط الصلاة بعد أن تصليها: مرة «في وقتها»، ومرتين «بعد الوقت»."}
            </T>
          </View>
        </Row>
        <Row gap={6}>
          {LOG_PRAYERS.map((p) => {
            const s = marks?.[today]?.[p];
            const at = times?.[p];
            const locked = !marks || (!!at && at.getTime() > now);
            return (
              <Pressable
                key={p}
                disabled={locked}
                onPress={() => void toggle(today, p)}
                accessibilityRole="button"
                accessibilityLabel={`${PRAYER_LABELS[p]}: ${s === "ontime" ? "في وقتها" : s === "late" ? "بعد الوقت" : locked ? "لم يحن وقتها" : "لم تُسجل"}`}
                style={{
                  flex: 1,
                  alignItems: "center",
                  gap: 4,
                  paddingVertical: 10,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderStyle: s ? "solid" : "dashed",
                  borderColor: s === "ontime" ? colors.primary : s === "late" ? LATE : colors.border,
                  backgroundColor: s === "ontime" ? colors.primary : s === "late" ? "rgba(217,119,6,0.15)" : "transparent",
                  opacity: locked ? 0.45 : 1,
                }}
              >
                <View style={{ height: 24, justifyContent: "center" }}>
                  {s === "ontime" ? (
                    <Check size={22} color={colors.primaryForeground} />
                  ) : s === "late" ? (
                    <Clock size={20} color={LATE} />
                  ) : locked ? (
                    <Lock size={16} color={colors.mutedForeground} />
                  ) : (
                    <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.mutedForeground, opacity: 0.5 }} />
                  )}
                </View>
                <T size={13} weight="semibold" color={s === "ontime" ? "primaryForeground" : "foreground"} align="center">
                  {PRAYER_LABELS[p]}
                </T>
                {at && prefs.place ? (
                  <T size={10} color={s === "ontime" ? "primaryForeground" : "mutedForeground"} align="center">
                    {fmtTime(at, prefs.place.timezone)}
                  </T>
                ) : null}
              </Pressable>
            );
          })}
        </Row>
        {!prefs.place ? (
          <Pressable onPress={() => router.navigate("/prayer")} accessibilityRole="link">
            <Row gap={4} style={{ justifyContent: "center" }}>
              <MapPin size={14} color={colors.primary} />
              <T size={12} color="primary">
                اختر مدينتك لتظهر المواقيت وتُقفل الصلوات التي لم يحن وقتها
              </T>
            </Row>
          </Pressable>
        ) : null}
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Stat value={ontime} label="في وقتها" color={colors.primary} />
        <Stat value={late} label="بعد الوقت" color={LATE} />
        <Stat value={full} label="أيام مكتملة" />
        <Stat value={streak} label="أيام متتالية" icon />
      </View>

      <Card style={{ gap: 4 }}>
        <T weight="semibold">آخر ٣٠ يومًا</T>
        <Row gap={0}>
          <View style={{ width: 84 }} />
          {LOG_PRAYERS.map((p) => (
            <T key={p} size={11} color="mutedForeground" align="center" style={{ flex: 1 }}>
              {PRAYER_LABELS[p]}
            </T>
          ))}
        </Row>
        {marks
          ? days.slice(1).map((d) => {
              const iso = d.toISODate()!;
              return (
                <Row key={iso} gap={0}>
                  <T size={12} weight={completeDay(marks, iso) ? "semibold" : "regular"} color={completeDay(marks, iso) ? "foreground" : "mutedForeground"} style={{ width: 84 }}>
                    {dayLabel(d)}
                  </T>
                  {LOG_PRAYERS.map((p) => (
                    <Dot key={p} status={marks[iso]?.[p]} label={`${PRAYER_LABELS[p]} ${dayLabel(d)}`} onPress={() => void toggle(iso, p as LogPrayer)} />
                  ))}
                </Row>
              );
            })
          : null}
      </Card>

      <Row gap={6} style={{ justifyContent: "center" }}>
        <Lock size={13} color={colors.mutedForeground} />
        <T size={12} color="mutedForeground" align="center">
          {synced ? "محفوظ في حسابك (نفس سجل البوت /salat)، ولا يراه أحد غيرك." : "محفوظ على هذا الجهاز فقط، ولا يراه أحد غيرك."}
        </T>
      </Row>
    </Screen>
  );
}

function Dot({ status, label, onPress }: { status: LogStatus | undefined; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ flex: 1, height: 32, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: status === "ontime" ? colors.primary : status === "late" ? LATE : "transparent",
          borderWidth: status ? 0 : 1,
          borderStyle: "dashed",
          borderColor: colors.mutedForeground,
        }}
      >
        {status === "ontime" ? <Check size={12} color={colors.primaryForeground} /> : status === "late" ? <Clock size={12} color="#ffffff" /> : null}
      </View>
    </Pressable>
  );
}

/** «٣/٥» inside a ring. */
function Ring({ value }: { value: number }) {
  const { colors } = useTheme();
  const c = 2 * Math.PI * 26;
  return (
    <View style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center" }}>
      <Svg width={64} height={64} viewBox="0 0 60 60" style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={30} cy={30} r={26} fill="none" strokeWidth={6} stroke={colors.muted} />
        <Circle cx={30} cy={30} r={26} fill="none" strokeWidth={6} strokeLinecap="round" stroke={colors.primary} strokeDasharray={`${(value / 5) * c} ${c}`} />
      </Svg>
      <T size={14} weight="bold">
        {`${n(value)}/٥`}
      </T>
    </View>
  );
}

function Stat({ value, label, color, icon }: { value: number; label: string; color?: string; icon?: boolean }) {
  const { colors } = useTheme();
  return (
    <Card style={{ width: "47%", flexGrow: 1, alignItems: "center", paddingVertical: 12 }}>
      <Row gap={4}>
        {icon ? <Flame size={16} color="#f97316" /> : null}
        <T size={22} weight="bold" color={color ?? colors.foreground}>
          {n(value)}
        </T>
      </Row>
      <T size={12} color="mutedForeground">
        {label}
      </T>
    </Card>
  );
}
