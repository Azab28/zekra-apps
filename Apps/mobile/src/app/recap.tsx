/**
 * «حصادي», as the site's /recap: the signed-in account's card for a month, a
 * quarter, a half or the whole Hijri year (this one or the last), from
 * /api/recap-link (it takes the app's session) and its signed
 * /api/recap-card; periods still ahead are shown greyed. Saved or shared.
 */
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { HIJRI_MONTHS, KIND_MONTHS, KIND_NAMES, PERIOD_KINDS, periodMonths, type PeriodKind } from "@lib/recap-periods";
import { LogIn, Share2, Sprout } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Button, Card, Row, Segmented, T } from "@/components/ui";
import { shareRemoteImage } from "@/core/images";
import { SITE_URL, sitePost } from "@/core/site";
import { sessionToken, useSync } from "@/core/sync";
import { useTheme } from "@/theme/theme";

type Period = {
  key: string;
  year: number;
  kind: PeriodKind;
  index: number;
  label: string;
  short: string;
  span: string;
  future?: true;
  partial?: boolean;
  empty?: boolean;
  url?: string | null;
};
type Data = { years: number[]; periods: Period[]; selected: string };

const monthRange = (p: Period) => {
  const { first, last } = periodMonths(p);
  return `${HIJRI_MONTHS[first - 1]} – ${HIJRI_MONTHS[last - 1]}`;
};

export default function Recap() {
  const { colors } = useTheme();
  const { user } = useSync();
  const [data, setData] = useState<Data | null | "failed">(null);
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let live = true;
    void sitePost<Data>("/api/recap-link", {}, sessionToken()).then((r) => {
      if (!live) return;
      if (!r.ok) return setData("failed");
      setData({ years: r.years, periods: r.periods, selected: r.selected });
      setKey(r.selected);
    });
    return () => {
      live = false;
    };
  }, [user]);

  if (!user) {
    return (
      <Screen back title="حصادي">
        <Card style={{ alignItems: "center", gap: 12 }}>
          <Sprout size={40} color={colors.primary} />
          <T color="mutedForeground" align="center">
            حصادك يُحسب من ختمتك وتسبيحك وأذكارك وسجل صلواتك المحفوظة في حسابك. سجّل الدخول لتراه، ويصلك أيضًا في البوت أول كل شهر هجري.
          </T>
          <Button label="تسجيل الدخول" icon={LogIn} onPress={() => router.push("/account")} />
        </Card>
      </Screen>
    );
  }
  if (data === null) {
    return (
      <Screen back title="حصادي">
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  const current = data !== "failed" ? data.periods.find((p) => p.key === key && !p.future) : undefined;
  if (data === "failed" || !current) {
    return (
      <Screen back title="حصادي">
        <Card>
          <T color="mutedForeground" align="center">
            تعذّر تحميل حصادك الآن، أعد المحاولة بعد قليل.
          </T>
        </Card>
      </Screen>
    );
  }

  const find = (year: number, kind: PeriodKind, index: number) => data.periods.find((p) => p.year === year && p.kind === kind && p.index === index);
  /** The period of `kind` in `year` holding the current one's first month, else the latest that has begun (as the site's). */
  const move = (year: number, kind: PeriodKind) => {
    const index = Math.ceil(periodMonths(current).first / KIND_MONTHS[kind]);
    const same = current.kind === "year" && kind !== "year" ? undefined : find(year, kind, kind === "year" ? 1 : index);
    const target = same && !same.future ? same : [...data.periods].reverse().find((p) => p.year === year && p.kind === kind && !p.future);
    if (target) setKey(target.key);
  };
  const choices = data.periods.filter((p) => p.year === current.year && p.kind === current.kind);
  const image = current.url ? SITE_URL + current.url : null;

  return (
    <Screen back title="حصادي">
      <Segmented options={data.years.map((y) => ({ value: y, label: `${toArabicDigits(y)} هـ` }))} value={current.year} onChange={(y) => move(y, current.kind)} />
      <Segmented options={PERIOD_KINDS.map((k) => ({ value: k, label: KIND_NAMES[k] }))} value={current.kind} onChange={(k) => move(current.year, k)} />
      {current.kind !== "year" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {choices.map((p) => {
            const on = p.key === current.key;
            return (
              <Pressable
                key={p.key}
                disabled={!!p.future}
                onPress={() => setKey(p.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: !!p.future }}
                style={{
                  width: current.kind === "month" ? "31%" : "48%",
                  flexGrow: 1,
                  alignItems: "center",
                  paddingVertical: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: on ? colors.primary : colors.border,
                  backgroundColor: on ? colors.primary : colors.card,
                  opacity: p.future ? 0.4 : 1,
                }}
              >
                <T size={13} weight="semibold" color={on ? "primaryForeground" : "foreground"} align="center">
                  {p.short}
                </T>
                {current.kind !== "month" ? (
                  <T size={10} color={on ? "primaryForeground" : "mutedForeground"} align="center">
                    {monthRange(p)}
                  </T>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <T size={13} color="mutedForeground" align="center">
        {current.label} · {current.span}
        {current.partial ? " (حتى اليوم)" : ""}
      </T>
      {image ? (
        <>
          <View style={{ alignSelf: "center", width: "85%", borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.muted }}>
            <Image source={{ uri: image }} style={{ width: "100%", aspectRatio: 9 / 16 }} contentFit="cover" transition={150} />
          </View>
          <Row style={{ justifyContent: "center" }}>
            <Button
              label={busy ? "جارٍ التجهيز…" : "حفظ أو مشاركة"}
              icon={Share2}
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                setError(null);
                setError(await shareRemoteImage(image, `recap-${current.key}`, `حصادي: ${current.label}`, false));
                setBusy(false);
              }}
            />
          </Row>
          {error ? (
            <T size={13} color="destructive" align="center">
              {error}
            </T>
          ) : null}
        </>
      ) : (
        <Card>
          <T color="mutedForeground" align="center">
            لم يُسجَّل لك شيء في هذه المدة بعد.
          </T>
        </Card>
      )}
    </Screen>
  );
}
