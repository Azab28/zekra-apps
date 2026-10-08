/**
 * The reminders beside the adhan (core/reminders.ts): a zikr every so often,
 * Al-Kahf on Friday, the Quran alarm (before fajr or at a time; a tap plays a
 * surah or a station), and the occasions — each on its own switch, all on
 * the phone.
 */
import { useState } from "react";
import { Linking, Pressable, TextInput, View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { radioStations } from "@lib/content/data";
import { OCCASIONS } from "@lib/occasions-meta";
import { Check, ChevronDown } from "@/components/icons";
import { Screen } from "@/components/screen";
import { useDialogs } from "@/components/sheet";
import { Card, ListRow, Segmented, SectionTitle, SwitchRow, T } from "@/components/ui";
import { askPermission, notificationsSupported } from "@/core/notifications";
import { surahs } from "@/core/quran";
import { ALARM_BEFORE, REMINDER_OCCASIONS, ZIKR_EVERY, type Reminders } from "@/core/settings";
import { useStore } from "@/core/store";
import { START } from "@/theme/rtl";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;
const everyLabel = (m: number) => (m < 60 ? `${n(m)} د` : m === 60 ? "ساعة" : m === 120 ? "ساعتان" : `${n(m / 60)} ساعات`);

export default function RemindersScreen() {
  const { settings, updateSettings, prefs } = useStore();
  const { colors } = useTheme();
  const dialogs = useDialogs();
  const r = settings.reminders;
  const [picking, setPicking] = useState<"surah" | "station" | null>(null);

  const set = (change: (r: Reminders) => Reminders) => updateSettings((s) => ({ ...s, reminders: change(s.reminders) }));

  /** Turning one on asks for the notifications first. */
  const turnOn = async (on: boolean, apply: () => void) => {
    if (!on) return apply();
    if (await askPermission()) return apply();
    const open = await dialogs.confirm({ title: "التنبيهات غير مسموحة", message: "اسمح لذِكرى بإرسال التنبيهات من إعدادات الجهاز.", confirm: "فتح الإعدادات", cancel: "لاحقًا" });
    if (open) void Linking.openSettings();
  };

  if (!notificationsSupported()) {
    return (
      <Screen back title="التذكيرات">
        <Card>
          <T color="mutedForeground">تطبيق Expo Go على أندرويد لا يسمح بالإشعارات؛ تعمل التذكيرات في نسخة التطوير أو النسخة النهائية من ذِكرى.</T>
        </Card>
      </Screen>
    );
  }

  const stations = radioStations();
  const station = stations.find((s) => s.id === r.alarm.station) ?? stations[0];

  return (
    <Screen back title="التذكيرات">
      <SectionTitle>الذكر</SectionTitle>
      <Card padded={false} style={{ overflow: "hidden" }}>
        <SwitchRow title="ذكّرني بالذكر" note="ذكر من حصن المسلم كل فترة، بإشعار هادئ" value={r.zikr.on} onChange={(on) => void turnOn(on, () => set((x) => ({ ...x, zikr: { ...x.zikr, on } })))} last />
      </Card>
      {r.zikr.on ? (
        <Segmented options={ZIKR_EVERY.map((m) => ({ value: m, label: everyLabel(m) }))} value={r.zikr.every} onChange={(every) => set((x) => ({ ...x, zikr: { ...x.zikr, every } }))} />
      ) : null}

      <SectionTitle>الجمعة</SectionTitle>
      <Card padded={false} style={{ overflow: "hidden" }}>
        <SwitchRow title="سورة الكهف" note="يوم الجمعة الساعة ١٠ صباحًا" value={r.kahf} onChange={(kahf) => void turnOn(kahf, () => set((x) => ({ ...x, kahf })))} last />
      </Card>

      <SectionTitle>منبّه القرآن</SectionTitle>
      <Card padded={false} style={{ overflow: "hidden" }}>
        <SwitchRow
          title="منبّه القرآن"
          note="اضغط التنبيه فتبدأ التلاوة"
          value={r.alarm.on}
          onChange={(on) => void turnOn(on, () => set((x) => ({ ...x, alarm: { ...x.alarm, on } })))}
          last
        />
      </Card>
      {r.alarm.on ? (
        <View style={{ gap: 10 }}>
          <Segmented
            options={[
              { value: "fajr", label: "قبل الفجر" },
              { value: "time", label: "في وقت أختاره" },
            ]}
            value={r.alarm.mode}
            onChange={(mode) => set((x) => ({ ...x, alarm: { ...x.alarm, mode } }))}
          />
          {r.alarm.mode === "fajr" ? (
            <>
              {!prefs.place ? (
                <T size={13} color="destructive">
                  اختر مدينتك من صفحة المواقيت ليُحسب وقت الفجر.
                </T>
              ) : null}
              <Segmented
                options={ALARM_BEFORE.filter((m) => m <= 60).map((m) => ({ value: m, label: m === 0 ? "عنده" : `${n(m)} د` }))}
                value={r.alarm.before}
                onChange={(before) => set((x) => ({ ...x, alarm: { ...x.alarm, before } }))}
              />
            </>
          ) : (
            <TimeField value={r.alarm.time} onChange={(time) => set((x) => ({ ...x, alarm: { ...x.alarm, time } }))} />
          )}
          <Segmented
            options={[
              { value: "surah", label: "سورة" },
              { value: "live", label: "إذاعة" },
            ]}
            value={r.alarm.play}
            onChange={(play) => set((x) => ({ ...x, alarm: { ...x.alarm, play } }))}
          />
          <Card padded={false} style={{ overflow: "hidden" }}>
            <ListRow
              title={r.alarm.play === "surah" ? `سورة ${surahs()[r.alarm.surah - 1]?.name ?? ""}` : (station?.name ?? "")}
              note={r.alarm.play === "surah" ? "بصوت القارئ المختار في الاستماع" : "إذاعة مباشرة"}
              onPress={() => setPicking((p) => (p ? null : r.alarm.play === "surah" ? "surah" : "station"))}
              trailing={<ChevronDown size={18} color={colors.mutedForeground} />}
              last={!picking}
            />
            {picking === "surah"
              ? surahs().map((s, i, all) => (
                  <ListRow
                    key={s.n}
                    title={`${n(s.n)}. ${s.name}`}
                    onPress={() => {
                      set((x) => ({ ...x, alarm: { ...x.alarm, surah: s.n } }));
                      setPicking(null);
                    }}
                    trailing={r.alarm.surah === s.n ? <Check size={16} color={colors.primary} /> : <View />}
                    last={i === all.length - 1}
                  />
                ))
              : picking === "station"
                ? stations.map((s, i, all) => (
                    <ListRow
                      key={s.id}
                      title={s.name}
                      onPress={() => {
                        set((x) => ({ ...x, alarm: { ...x.alarm, station: s.id } }));
                        setPicking(null);
                      }}
                      trailing={r.alarm.station === s.id ? <Check size={16} color={colors.primary} /> : <View />}
                      last={i === all.length - 1}
                    />
                  ))
                : null}
          </Card>
        </View>
      ) : null}

      <SectionTitle>المناسبات</SectionTitle>
      <Card padded={false} style={{ overflow: "hidden" }}>
        <SwitchRow
          title="تنبيهات المناسبات"
          note="أيام الصيام، ورمضان، وذو الحجة، والعيد…"
          value={r.occasions.on}
          onChange={(on) => void turnOn(on, () => set((x) => ({ ...x, occasions: { ...x.occasions, on } })))}
          last={!r.occasions.on}
        />
        {r.occasions.on
          ? REMINDER_OCCASIONS.map((k, i) => {
              const on = r.occasions.kinds.includes(k);
              return (
                <ListRow
                  key={k}
                  title={OCCASIONS[k].label}
                  note={OCCASIONS[k].when}
                  onPress={() => set((x) => ({ ...x, occasions: { ...x.occasions, kinds: on ? x.occasions.kinds.filter((y) => y !== k) : [...x.occasions.kinds, k] } }))}
                  trailing={
                    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : "transparent", alignItems: "center", justifyContent: "center" }}>
                      {on ? <Check size={14} color={colors.primaryForeground} /> : null}
                    </View>
                  }
                  last={i === REMINDER_OCCASIONS.length - 1}
                />
              );
            })
          : null}
      </Card>
      <T size={12} color="mutedForeground">
        تُجدوَل على جهازك لأيام قادمة وتتجدّد كلما فتحت التطبيق.
      </T>
    </Screen>
  );
}

/** «05:00», typed as hours and minutes. */
function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { colors } = useTheme();
  const [text, setText] = useState(value);
  const commit = (v: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).trim());
    if (m && Number(m[1]) < 24 && Number(m[2]) < 60) onChange(`${m[1].padStart(2, "0")}:${m[2]}`);
    else setText(value);
  };
  return (
    <View style={{ gap: 4 }}>
      <T size={13} color="mutedForeground">
        الوقت (٢٤ ساعة، مثل ٠٥:٠٠)
      </T>
      <TextInput
        value={text}
        onChangeText={setText}
        onEndEditing={() => commit(text)}
        keyboardType="numbers-and-punctuation"
        style={{ height: 44, borderRadius: 12, backgroundColor: colors.muted, paddingHorizontal: 12, color: colors.foreground, fontFamily: "Plex-Regular", fontSize: 16, textAlign: START }}
      />
      <Pressable onPress={() => commit(text)} accessibilityRole="button">
        <T size={13} color="primary">
          حفظ الوقت
        </T>
      </Pressable>
    </View>
  );
}
