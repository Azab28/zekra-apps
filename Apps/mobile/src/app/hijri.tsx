/** The Hijri calendar as on the site (/hijri): today, the coming occasions and a month grid, all from src/lib/hijri-core with the site's offset. */
import { DateTime } from "luxon";
import { useState } from "react";
import { View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { hijriMonthName, hijriMonthStart, hijriOf, upcomingEvents } from "@lib/hijri-core";
import { withoutEmoji } from "@lib/plain-text";
import { ChevronLeft, ChevronRight, MoonStar } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Card, IconButton, Row, T } from "@/components/ui";
import { hijriText } from "@/core/hijri";
import { deviceZone } from "@/core/prayer";
import { useStore } from "@/core/store";
import { css, alpha } from "@/theme/colors";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;
/** Saturday first, as calendars in the Arab world usually are (Luxon: 6 = Saturday). */
const WEEK = [6, 7, 1, 2, 3, 4, 5];
const WEEKDAY_SHORT: Record<number, string> = { 6: "سبت", 7: "أحد", 1: "إثنين", 2: "ثلاثاء", 3: "أربعاء", 4: "خميس", 5: "جمعة" };

const inWords = (days: number) =>
  days === 0 ? "اليوم" : days === 1 ? "غدًا" : days === 2 ? "بعد يومين" : days <= 10 ? `بعد ${n(days)} أيام` : `بعد ${n(days)} يومًا`;

const noon = (d: DateTime) => new Date(Date.UTC(d.year, d.month - 1, d.day, 12));
const gregorian = (d: DateTime, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("ar-EG", { ...opts, timeZone: "UTC" }).format(noon(d));

export default function Hijri() {
  const { prefs, hijriOffset: offset } = useStore();
  const { colors, raw } = useTheme();
  const [months, setMonths] = useState(0);
  const zone = prefs.place?.timezone ?? deviceZone() ?? "UTC";
  const today = DateTime.now().setZone(zone).startOf("day");
  const label = hijriText(today, offset);

  // This phone's Intl has no Umm al-Qura calendar: say so instead of wrong dates.
  if (!label) {
    return (
      <Screen back title="التقويم الهجري">
        <Card>
          <T color="mutedForeground">لا يدعم هذا الجهاز التقويم الهجري (أم القرى)، فلا يمكن عرض التقويم عليه.</T>
        </Card>
      </Screen>
    );
  }

  const h = hijriOf(today, offset);
  const events = upcomingEvents(today, offset);
  const start = hijriMonthStart(today, months, offset);
  const monthNo = hijriOf(start, offset).month;
  const days: DateTime[] = [];
  for (let d = start; hijriOf(d, offset).month === monthNo && days.length < 31; d = d.plus({ days: 1 })) days.push(d);
  const lead = WEEK.indexOf(start.weekday);
  const gregRange = `${gregorian(days[0], { month: "long" })} – ${gregorian(days[days.length - 1], { month: "long", year: "numeric" })}`;
  const cells: (DateTime | null)[] = [...Array.from({ length: lead }, () => null), ...days];
  while (cells.length % 7) cells.push(null);
  const gold = css(alpha(raw.gold, 0.18));

  return (
    <Screen back title="التقويم الهجري">
      <View style={{ backgroundColor: colors.primary, borderRadius: 24, padding: 20, alignItems: "center", gap: 2 }}>
        <T size={14} color="primaryForeground" align="center" style={{ opacity: 0.85 }}>
          {gregorian(today, { weekday: "long" })}
        </T>
        <T size={28} weight="bold" color="primaryForeground" align="center">
          {label}
        </T>
        <T size={14} color="primaryForeground" align="center" style={{ opacity: 0.85 }}>
          {gregorian(today, { day: "numeric", month: "long", year: "numeric" })}
        </T>
        {h.month === 9 ? (
          <Row gap={6} style={{ marginTop: 6 }}>
            <MoonStar size={16} color={colors.primaryForeground} />
            <T size={14} weight="semibold" color="primaryForeground">
              اليوم {n(h.day)} من رمضان
            </T>
          </Row>
        ) : null}
      </View>

      <Card padded={false} style={{ overflow: "hidden" }}>
        <T weight="semibold" style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
          المناسبات القادمة
        </T>
        {events.map((e, i) => (
          <Row key={e.label} style={{ justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
            <T size={14} weight="medium" style={{ flex: 1 }}>
              {withoutEmoji(e.label)}
            </T>
            <View>
              <T size={14} weight="semibold" align="end" color={e.days <= 7 ? "primary" : "foreground"}>
                {inWords(e.days)}
              </T>
              <T size={12} color="mutedForeground" align="end">
                {gregorian(e.date, { weekday: "long", day: "numeric", month: "long" })}
              </T>
            </View>
          </Row>
        ))}
      </Card>

      <Card style={{ gap: 8 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <IconButton icon={ChevronRight} label="الشهر السابق" onPress={() => setMonths((m) => Math.max(m - 1, -12))} />
          <View style={{ alignItems: "center", flex: 1 }}>
            <T weight="bold" align="center">
              {hijriMonthName(start, offset)} {n(hijriOf(start, offset).year)} هـ
            </T>
            <T size={12} color="mutedForeground" align="center">
              {gregRange}
            </T>
          </View>
          <IconButton icon={ChevronLeft} label="الشهر التالي" onPress={() => setMonths((m) => Math.min(m + 1, 12))} />
        </Row>
        <View style={{ flexDirection: "row" }}>
          {WEEK.map((w) => (
            <T key={w} size={11} color="mutedForeground" align="center" style={{ flex: 1 }}>
              {WEEKDAY_SHORT[w]}
            </T>
          ))}
        </View>
        {Array.from({ length: cells.length / 7 }, (_, row) => (
          <View key={row} style={{ flexDirection: "row", gap: 3 }}>
            {cells.slice(row * 7, row * 7 + 7).map((d, i) => {
              if (!d) return <View key={`e${i}`} style={{ flex: 1 }} />;
              const hd = hijriOf(d, offset).day;
              const isToday = d.equals(today);
              const white = hd >= 13 && hd <= 15;
              return (
                <View
                  key={d.toISODate()}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    paddingVertical: 4,
                    backgroundColor: isToday ? colors.primary : white ? gold : d.weekday === 5 ? colors.muted : "transparent",
                  }}
                >
                  <T size={15} weight="semibold" align="center" color={isToday ? "primaryForeground" : "foreground"} style={{ lineHeight: 22 }}>
                    {n(hd)}
                  </T>
                  <T size={9} align="center" color={isToday ? "primaryForeground" : "mutedForeground"} style={{ lineHeight: 13 }}>
                    {gregorian(d, { day: "numeric", month: "numeric" })}
                  </T>
                </View>
              );
            })}
          </View>
        ))}
        <Row style={{ justifyContent: "center", flexWrap: "wrap", gap: 14, marginTop: 4 }}>
          <Legend color={colors.primary} label="اليوم" />
          <Legend color={css(alpha(raw.gold, 0.35))} label="الأيام البيض" />
          <Legend color={colors.muted} label="الجمعة" />
        </Row>
      </Card>
      <T size={12} color="mutedForeground" align="center">
        بتقويم أم القرى؛ قد يختلف يومًا حسب رؤية الهلال في بلدك.
      </T>
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Row gap={6}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color }} />
      <T size={12} color="mutedForeground">
        {label}
      </T>
    </Row>
  );
}
