/**
 * Shared khatmas, as the site's /k: the ones this phone started or took a juz
 * in (`mine`), opening one from a link someone sent, and starting a new one —
 * a group khatma, or a «صدقة جارية» page in someone's name.
 */
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, TextInput, View, type TextStyle } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { stripMercy } from "@lib/honoree";
import type { MyRoom } from "@lib/khatma-room";
import { BookOpen, ChevronLeft, Crown, HandHeart, Link2, Plus, UsersRound } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Button, Card, Row, Segmented, SectionTitle, T } from "@/components/ui";
import { roomCall, slugFrom } from "@/core/rooms";
import { START } from "@/theme/rtl";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;
const openRoom = (slug: string) => router.push({ pathname: "/k/[slug]", params: { slug } });

export default function Rooms() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const { colors } = useTheme();
  const [rooms, setRooms] = useState<MyRoom[] | null>(null);
  const [link, setLink] = useState("");
  const input: TextStyle = { flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.muted, paddingHorizontal: 12, color: colors.foreground, fontFamily: "Plex-Regular", fontSize: 15, textAlign: START };

  useFocusEffect(
    useCallback(() => {
      void roomCall({ action: "mine" }).then((r) => setRooms(r?.rooms ?? []));
    }, []),
  );

  const slug = slugFrom(link);
  return (
    <Screen back title="ختمة جماعية وصدقة جارية">
      <T color="mutedForeground">
        صفحة برابط تشاركه مع أهلك وأصحابك: كل واحد يحجز جزءًا ويعلّمه عند إتمامه، ويظهر التقدّم للجميع. تعمل أيضًا داخل مجموعات تيليجرام بالأمر /groupkhatma.
      </T>

      <SectionTitle>ختماتك</SectionTitle>
      {rooms === null ? (
        <Card>
          <T color="mutedForeground">…</T>
        </Card>
      ) : rooms.length === 0 ? (
        <Card>
          <T size={14} color="mutedForeground" align="center">
            لم تنضم إلى ختمة جماعية بعد. أنشئ واحدة وشارك رابطها، أو افتح رابط ختمة أُرسل إليك.
          </T>
        </Card>
      ) : (
        rooms.map((r) => (
          <Pressable key={r.slug} onPress={() => openRoom(r.slug)} accessibilityRole="button">
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
                {r.kind === "memorial" ? <HandHeart size={20} color={colors.primary} /> : <UsersRound size={20} color={colors.primary} />}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Row gap={6}>
                  <T weight="medium" lines={1} style={{ flexShrink: 1 }}>
                    {r.heading}
                  </T>
                  {r.created ? <Crown size={13} color={colors.gold} /> : null}
                </Row>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.muted, overflow: "hidden" }}>
                  <View style={{ height: 5, width: `${(r.done / 30) * 100}%`, backgroundColor: colors.primary }} />
                </View>
                <T size={12} color="mutedForeground">
                  {r.round > 1 ? `الختمة ${n(r.round)} · ` : ""}تم {n(r.done)} من ٣٠{r.taken > 0 ? ` · أجزاؤك: أتممت ${n(r.finished)} من ${n(r.taken)}` : ""}
                </T>
              </View>
              <ChevronLeft size={16} color={colors.mutedForeground} />
            </Card>
          </Pressable>
        ))
      )}

      <SectionTitle>افتح رابط ختمة</SectionTitle>
      <Row>
        <TextInput value={link} onChangeText={setLink} autoCapitalize="none" autoCorrect={false} placeholder="zekra.site/k/…" placeholderTextColor={colors.mutedForeground} style={[input, { textAlign: "left", writingDirection: "ltr" }]} />
        <Button label="افتح" icon={Link2} size="sm" disabled={!slug} onPress={() => slug && openRoom(slug)} />
      </Row>

      <SectionTitle>صفحة جديدة</SectionTitle>
      <CreateRoom initialKind={params.kind === "memorial" ? "memorial" : "group"} input={input} />
    </Screen>
  );
}

function CreateRoom({ initialKind, input }: { initialKind: "group" | "memorial"; input: TextStyle }) {
  const { colors } = useTheme();
  const [kind, setKind] = useState(initialKind);
  const [title, setTitle] = useState("");
  const [honoree, setHonoree] = useState("");
  const [female, setFemale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = stripMercy(honoree) || "…";

  const submit = async () => {
    if (kind === "memorial" && honoree.trim().length < 2) return setError("اكتب اسم المتوفى");
    setBusy(true);
    setError(null);
    const r = await roomCall({ action: "create", kind, title, honoree, female });
    setBusy(false);
    if (r?.slug) return openRoom(r.slug);
    setError(r?.message ?? (r?.error && /[؀-ۿ]/.test(r.error) ? r.error : "تعذّر الإنشاء، حاول مرة أخرى"));
  };

  return (
    <Card style={{ gap: 12 }}>
      <Segmented
        options={[
          { value: "group", label: "ختمة جماعية", icon: BookOpen },
          { value: "memorial", label: "صدقة جارية", icon: HandHeart },
        ]}
        value={kind}
        onChange={setKind}
      />
      {kind === "group" ? (
        <TextInput value={title} onChangeText={setTitle} maxLength={60} placeholder="اسم الختمة (اختياري)، مثال: ختمة العائلة" placeholderTextColor={colors.mutedForeground} style={input} />
      ) : (
        <View style={{ gap: 10 }}>
          <TextInput value={honoree} onChangeText={setHonoree} maxLength={40} placeholder="اسم المتوفى" placeholderTextColor={colors.mutedForeground} style={input} />
          <View style={{ backgroundColor: colors.muted, borderRadius: 12, padding: 10 }}>
            <T size={13} color="mutedForeground">
              تظهر الصفحة بعنوان:
            </T>
            <T size={14} weight="semibold">
              صدقة جارية عن {shown} {female ? "رحمها الله" : "رحمه الله"}
            </T>
          </View>
          <Segmented
            options={[
              { value: "m", label: "رحمه الله" },
              { value: "f", label: "رحمها الله" },
            ]}
            value={female ? "f" : "m"}
            onChange={(v) => setFemale(v === "f")}
          />
          <T size={12} color="mutedForeground">
            صفحة باسمه فيها ختمة جماعية، وعدّادات للتسبيح والاستغفار والصلاة على النبي ﷺ وقراءة السور. انشر رابطها لأهلك وأصحابك.
          </T>
        </View>
      )}
      {error ? (
        <T size={13} color="destructive">
          {error}
        </T>
      ) : null}
      <Button label={busy ? "جارٍ الإنشاء…" : "إنشاء الصفحة"} icon={Plus} disabled={busy} onPress={() => void submit()} />
    </Card>
  );
}
