/** The tasbeeh as on the site (/tasbeeh): a phrase from src/lib/tasbeeh.ts, counted to 33 / 99 / open; the day's and all-time totals kept through the site's `tasbeeh` action. */
import { DateTime } from "luxon";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { TASBEEH_PHRASES, TASBEEH_TARGETS } from "@lib/tasbeeh";
import { CounterButton, haptic } from "@/components/counter";
import { Check, RotateCcw, Target } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Button, Card, Row, T } from "@/components/ui";
import { deviceZone } from "@/core/prayer";
import { useStore } from "@/core/store";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;

export default function Tasbeeh() {
  const { prefs, dispatch } = useStore();
  const { colors } = useTheme();
  const [phrase, setPhrase] = useState(0);
  const [count, setCount] = useState(0);
  const [target, setTarget] = useState(33);
  const zone = prefs.place?.timezone ?? deviceZone() ?? "UTC";
  const today = DateTime.now().setZone(zone).toISODate() ?? "";
  const todayCount = prefs.tasbeeh.day === today ? prefs.tasbeeh.today : 0;
  const done = target > 0 && count >= target;

  const tap = () => {
    const next = count + 1;
    setCount(next);
    haptic(target > 0 && next === target ? "done" : "tap");
    dispatch({ type: "tasbeeh", add: 1, day: today });
  };

  const choose = (i: number) => {
    setPhrase(i);
    setCount(0);
  };

  return (
    <Screen back title="السبحة">
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
        {TASBEEH_PHRASES.map((p, i) => {
          const on = i === phrase;
          return (
            <Pressable
              key={p}
              onPress={() => choose(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{ borderRadius: 999, borderWidth: 1, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card, paddingHorizontal: 12, paddingVertical: 5 }}
            >
              <T size={14} color={on ? "primaryForeground" : "foreground"}>
                {p}
              </T>
            </Pressable>
          );
        })}
      </View>

      <View style={{ alignItems: "center", gap: 18, paddingVertical: 12 }}>
        <T size={30} weight="bold" align="center" style={{ lineHeight: 54 }}>
          {TASBEEH_PHRASES[phrase]}
        </T>
        <CounterButton size={232} value={target > 0 ? count / target : null} dim={done} onPress={tap} label="سبّح">
          <T size={60} weight="bold" color="primaryForeground" align="center" style={{ lineHeight: 76 }}>
            {n(count)}
          </T>
          {done ? (
            <Row gap={4}>
              <Check size={16} color={colors.primaryForeground} />
              <T size={14} color="primaryForeground">
                اكتمل
              </T>
            </Row>
          ) : (
            <T size={14} color="primaryForeground" align="center" style={{ opacity: 0.85 }}>
              {target ? `من ${n(target)}` : "عدّ مفتوح"}
            </T>
          )}
        </CounterButton>
        <Row>
          <Button label="من جديد" icon={RotateCcw} variant="outline" size="sm" onPress={() => setCount(0)} />
          <Button
            label={`الهدف: ${target ? n(target) : "مفتوح"}`}
            icon={Target}
            variant="outline"
            size="sm"
            onPress={() => setTarget(TASBEEH_TARGETS[(TASBEEH_TARGETS.indexOf(target) + 1) % TASBEEH_TARGETS.length])}
          />
        </Row>
      </View>

      <Row gap={12} align="stretch">
        <Card style={{ flex: 1, alignItems: "center" }}>
          <T size={12} color="mutedForeground" align="center">
            تسبيحك اليوم
          </T>
          <T size={24} weight="bold" align="center">
            {n(todayCount)}
          </T>
        </Card>
        <Card style={{ flex: 1, alignItems: "center" }}>
          <T size={12} color="mutedForeground" align="center">
            المجموع
          </T>
          <T size={24} weight="bold" align="center">
            {n(prefs.tasbeeh.total)}
          </T>
        </Card>
      </Row>
    </Screen>
  );
}
