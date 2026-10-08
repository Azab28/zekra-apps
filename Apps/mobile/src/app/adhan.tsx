/** Adhan notifications on this device: on/off, which prayers, the muezzin, a reminder before, morning/evening azkar, and a test. */
import { useEffect, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { BellRing, Check } from "@/components/icons";
import { Screen } from "@/components/screen";
import { useDialogs } from "@/components/sheet";
import { Button, Card, ListRow, Row, Segmented, SectionTitle, SwitchRow, T } from "@/components/ui";
import { ADHAN_VOICES, SYSTEM_SOUND, voiceName } from "@/core/adhan-voices";
import { askPermission, hasPermission, notificationsSupported, plan, sendTest } from "@/core/notifications";
import { fmtTime } from "@/core/prayer";
import { BEFORE_OPTIONS, SALAH } from "@/core/settings";
import { useStore } from "@/core/store";
import { useTheme } from "@/theme/theme";
import { PRAYER_LABELS } from "@lib/schedule/prayer-calc";
import { toArabicDigits } from "@lib/content/arabic";

export default function AdhanSettings() {
  const { prefs, settings, updateSettings } = useStore();
  const dialogs = useDialogs();
  const { colors } = useTheme();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const a = settings.adhan;
  const place = prefs.place;
  const supported = notificationsSupported();

  useEffect(() => {
    if (supported) void hasPermission().then(setAllowed);
  }, [supported]);

  const setAdhan = (change: Partial<typeof a>) => updateSettings((s) => ({ ...s, adhan: { ...s.adhan, ...change } }));

  const turnOn = async (on: boolean) => {
    if (!on) return setAdhan({ enabled: false });
    const ok = await askPermission();
    setAllowed(ok);
    if (ok) return setAdhan({ enabled: true });
    const open = await dialogs.confirm({
      title: "التنبيهات غير مسموحة",
      message: "اسمح لذِكرى بإرسال التنبيهات من إعدادات الجهاز ليصلك الأذان.",
      confirm: "فتح الإعدادات",
      cancel: "لاحقًا",
    });
    if (open) void Linking.openSettings();
  };

  const next = place ? plan(place, settings)[0] : undefined;

  if (!supported) {
    return (
      <Screen back title="تنبيه الأذان">
        <Card style={{ gap: 8 }}>
          <T weight="semibold">يحتاج نسخة التطوير</T>
          <T size={14} color="mutedForeground">
            تطبيق Expo Go على أندرويد لا يسمح بالإشعارات، فتنبيه الأذان يعمل في نسخة التطوير من ذِكرى (bun run android:dev) أو في النسخة النهائية من التطبيق. باقي الأقسام تعمل هنا كما هي.
          </T>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen back title="تنبيه الأذان">
      {!place && (
        <Card>
          <T color="mutedForeground">اختر مدينتك أولًا من صفحة المواقيت لتُحسب أوقات التنبيه.</T>
        </Card>
      )}
      <Card padded={false} style={{ overflow: "hidden" }}>
        <SwitchRow title="تنبيه الأذان والأذكار" note="يعمل من الجهاز نفسه ولو بلا إنترنت" value={a.enabled && allowed !== false} onChange={(v) => void turnOn(v)} disabled={!place} last />
      </Card>

      {a.enabled && (
        <>
          <SectionTitle>الصلوات</SectionTitle>
          <Card padded={false} style={{ overflow: "hidden" }}>
            {SALAH.map((k) => (
              <SwitchRow key={k} title={PRAYER_LABELS[k]} value={a.prayers[k]} onChange={(v) => setAdhan({ prayers: { ...a.prayers, [k]: v } })} />
            ))}
            <SwitchRow title="الشروق" note="خروج وقت الفجر" value={a.sunrise} onChange={(sunrise) => setAdhan({ sunrise })} last />
          </Card>

          <SectionTitle>صوت الأذان</SectionTitle>
          <Card padded={false} style={{ overflow: "hidden" }}>
            {[SYSTEM_SOUND, ...ADHAN_VOICES.map(([id]) => id)].map((id, i, all) => (
              <ListRow
                key={id}
                title={voiceName(id)}
                note={id === SYSTEM_SOUND ? "تنبيه قصير" : undefined}
                onPress={() => setAdhan({ voice: id })}
                last={i === all.length - 1}
                trailing={a.voice === id ? <Check size={18} color={colors.primary} /> : <View />}
              />
            ))}
          </Card>
          <T size={12} color="mutedForeground">
            {Platform.OS === "ios" ? "يسمح iOS بثلاثين ثانية فقط لصوت التنبيه، فيُسمع أول الأذان." : "يُسمع الأذان كاملًا، ويتوقف إذا مسحت التنبيه."}
          </T>

          <SectionTitle>تذكير قبل الأذان</SectionTitle>
          <Segmented
            options={BEFORE_OPTIONS.map((m) => ({ value: m, label: m === 0 ? "بدون" : `${toArabicDigits(m)} د` }))}
            value={a.before}
            onChange={(before) => setAdhan({ before })}
          />

          <SectionTitle>الأذكار</SectionTitle>
          <Card padded={false} style={{ overflow: "hidden" }}>
            <SwitchRow title="أذكار الصباح" note="بعد الفجر بعشرين دقيقة" value={a.morning} onChange={(morning) => setAdhan({ morning })} />
            <SwitchRow title="أذكار المساء" note="بعد العصر بعشرين دقيقة" value={a.evening} onChange={(evening) => setAdhan({ evening })} last />
          </Card>

          <Card style={{ gap: 10, marginTop: 8 }}>
            {next && place ? (
              <T size={14} color="mutedForeground">
                التنبيه القادم: {next.title} — {fmtTime(next.at, place.timezone)}
              </T>
            ) : null}
            <T size={13} color="mutedForeground">
              تُجدوَل التنبيهات لأيام قادمة وتتجدّد كلما فتحت التطبيق، فافتحه مرة كل بضعة أيام.
            </T>
            <Row>
              <Button label="جرّب التنبيه" icon={BellRing} variant="outline" size="sm" onPress={() => void sendTest(place?.city ?? "ذِكرى", a.voice)} />
            </Row>
          </Card>
        </>
      )}
      <View style={{ height: 8 }} />
    </Screen>
  );
}
