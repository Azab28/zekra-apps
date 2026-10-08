/** A month of prayer times for the saved place (24-hour times, as the site's month table), month by month. */
import { DateTime } from "luxon";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { PRAYER_LABELS, prayerTimesFor } from "@lib/schedule/prayer-calc";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Card, IconButton, Row, T } from "@/components/ui";
import { calcPlace, ORDER } from "@/core/prayer";
import { useStore } from "@/core/store";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;
const hm = (d: Date, zone: string) => {
  const t = DateTime.fromJSDate(d).setZone(zone);
  return `${n(t.hour)}:${n(String(t.minute).padStart(2, "0"))}`;
};
const noon = (d: DateTime) => new Date(Date.UTC(d.year, d.month - 1, d.day, 12));

export default function PrayerMonth() {
  const { prefs, settings } = useStore();
  const { colors } = useTheme();
  const [shift, setShift] = useState(0);
  const place = prefs.place;
  const zone = place?.timezone ?? "UTC";
  const today = DateTime.now().setZone(zone).startOf("day");
  const first = today.startOf("month").plus({ months: shift });
  const rows = useMemo(() => {
    if (!place) return [];
    const p = calcPlace(place, settings.madhab);
    return Array.from({ length: first.daysInMonth ?? 30 }, (_, i) => {
      const d = first.plus({ days: i });
      return { d, t: prayerTimesFor(d, p) };
    });
  }, [place, settings.madhab, first]);
  const monthName = new Intl.DateTimeFormat("ar-EG", { timeZone: "UTC", month: "long", year: "numeric" }).format(noon(first));
  const dayName = (d: DateTime) => new Intl.DateTimeFormat("ar-EG", { timeZone: "UTC", weekday: "short" }).format(noon(d));

  if (!place) {
    return (
      <Screen back title="جدول الشهر">
        <Card>
          <T color="mutedForeground">اختر مدينتك أولًا من صفحة المواقيت.</T>
        </Card>
      </Screen>
    );
  }

  const cell = { flex: 1, paddingVertical: 8 } as const;
  return (
    <Screen back title="جدول الشهر" contentStyle={{ paddingHorizontal: 8 }}>
      <Row style={{ justifyContent: "space-between", paddingHorizontal: 8 }}>
        <IconButton icon={ChevronRight} label="الشهر السابق" onPress={() => setShift(shift - 1)} />
        <View style={{ alignItems: "center" }}>
          <T size={17} weight="bold" align="center">
            {monthName}
          </T>
          <T size={12} color="mutedForeground" align="center">
            {place.city}
          </T>
        </View>
        <IconButton icon={ChevronLeft} label="الشهر التالي" onPress={() => setShift(shift + 1)} />
      </Row>
      <Card padded={false} style={{ overflow: "hidden" }}>
        <Row gap={0} style={{ backgroundColor: colors.muted, paddingHorizontal: 6 }}>
          <T size={11} weight="semibold" color="mutedForeground" style={[cell, { flex: 1.3 }]}>
            اليوم
          </T>
          {ORDER.map((k) => (
            <T key={k} size={11} weight="semibold" color="mutedForeground" align="center" style={cell}>
              {PRAYER_LABELS[k]}
            </T>
          ))}
        </Row>
        {rows.map(({ d, t }) => {
          const isToday = d.equals(today);
          return (
            <Row key={d.day} gap={0} style={{ paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: isToday ? colors.accent : "transparent" }}>
              <T size={12} weight={isToday ? "bold" : "regular"} style={[cell, { flex: 1.3 }]} lines={1}>
                {`${dayName(d)} ${n(d.day)}`}
              </T>
              {ORDER.map((k) => (
                <T key={k} size={12} weight={isToday ? "bold" : "regular"} color={isToday ? "primary" : "foreground"} align="center" style={cell}>
                  {hm(t[k], zone)}
                </T>
              ))}
            </Row>
          );
        })}
      </Card>
    </Screen>
  );
}
