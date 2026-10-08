/**
 * «الاستماع», as the extension's player popup: surahs suggested for the time
 * (Al-Kahf on Friday, Al-Mulk at night, Al-Baqarah every few days) in the
 * chosen recitation, the listening wird (a juz a day, ayah by ayah, where it
 * is kept as it plays), the recently played, and the favourite reciters and
 * stations.
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { AYAH_RECITERS, ayahReciter } from "@lib/ayah-audio";
import { toArabicDigits } from "@lib/content/arabic";
import { radioStations, reciters } from "@lib/content/data";
import { Check, ChevronDown, ChevronLeft, Headphones, Play, Radio as RadioIcon, Sparkles, Star } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Button, Card, ListRow, Row, SectionTitle, T } from "@/components/ui";
import { baqarahAt, juzRange, loadRecent, loadWird, stationTrack, suggestions, surahTrack, wirdProgress, type Recent, type Suggestion, type Wird } from "@/core/listen";
import { ayahLoop, usePlayer } from "@/core/player";
import { calcPlace } from "@/core/prayer";
import { surahName } from "@/core/quran";
import { useStore } from "@/core/store";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;

export default function Listen() {
  const { colors } = useTheme();
  const { settings, updateSettings, prefs } = useStore();
  const player = usePlayer();
  const listen = settings.listen;
  const [recent, setRecent] = useState<Recent[]>([]);
  const [wird, setWird] = useState<Wird | null>(null);
  const [suggested, setSuggested] = useState<Suggestion[]>([]);
  const [choosing, setChoosing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void loadRecent().then(setRecent);
      void loadWird().then(setWird);
      void baqarahAt().then((at) => setSuggested(suggestions(prefs.place ? calcPlace(prefs.place, settings.madhab) : null, at ?? null)));
    }, [prefs.place, settings.madhab]),
  );

  const reciter = reciters().find((r) => r.id === listen.reciterId);
  const moshaf = reciter?.moshaf.find((m) => m.id === listen.moshafId);
  const playSurah = (surah: number) => {
    const t = surahTrack(listen, surah);
    if (t) {
      player.play(t);
      router.push("/player");
    }
  };

  const progress = wird ? wirdProgress(wird) : null;
  const playWird = () => {
    if (!wird || !progress) return;
    const r = juzRange(wird.pos);
    player.play({ ...ayahLoop(listen.wirdReciter, wird.pos, r.end, 1), wird: true });
    router.push("/player");
  };

  const favReciters = reciters().filter((r) => listen.favReciters.includes(r.id));
  const favStations = radioStations().filter((s) => listen.favStations.includes(s.id));

  return (
    <Screen back title="الاستماع">
      <Card style={{ gap: 6 }}>
        <T size={13} color="mutedForeground">
          القارئ المختار للاقتراحات والمنبّه
        </T>
        <Row style={{ justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <T weight="semibold">{reciter?.name ?? "—"}</T>
            <T size={12} color="mutedForeground">
              {moshaf?.name ?? ""}
            </T>
          </View>
          <Button label="تغيير" size="sm" variant="outline" onPress={() => router.push("/recitations")} />
        </Row>
        <T size={12} color="mutedForeground">
          اختر قارئًا من التلاوات واضغط «اجعله المختار».
        </T>
      </Card>

      {suggested.length ? (
        <>
          <SectionTitle>مقترح الآن</SectionTitle>
          <Card padded={false} style={{ overflow: "hidden" }}>
            {suggested.map((s, i) => (
              <ListRow key={s.surah} icon={Sparkles} title={`سورة ${surahName(s.surah)}`} note={s.why} onPress={() => playSurah(s.surah)} trailing={<Play size={18} color={colors.primary} />} last={i === suggested.length - 1} />
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>ورد الاستماع: جزء كل يوم</SectionTitle>
      <Card style={{ gap: 10 }}>
        {progress && wird ? (
          <>
            <Row style={{ justifyContent: "space-between" }}>
              <T weight="semibold">الجزء {n(progress.juz)}</T>
              <T size={12} color={progress.done ? "primary" : "mutedForeground"}>
                {progress.done ? "أتممت جزء اليوم" : `${n(Math.round(progress.part * 100))}٪ من الجزء`}
              </T>
            </Row>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.muted, overflow: "hidden" }}>
              <View style={{ height: 6, width: `${Math.round(progress.part * 100)}%`, backgroundColor: colors.primary }} />
            </View>
            <T size={12} color="mutedForeground">
              آية بآية بصوت {ayahReciter(listen.wirdReciter).name}، ويُحفظ موضعك. {wird.khatmas > 0 ? `ختمات سماعًا: ${n(wird.khatmas)}` : ""}
            </T>
            <Row>
              <Button label={wird.pos === juzRange(wird.pos).start ? `استمع للجزء ${n(progress.juz)}` : "تابع الاستماع"} icon={Headphones} size="sm" onPress={playWird} />
              <Button label="القارئ" icon={ChevronDown} size="sm" variant="outline" onPress={() => setChoosing((v) => !v)} />
            </Row>
            {choosing ? (
              <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
                {AYAH_RECITERS.map((r, i) => (
                  <ListRow
                    key={r.id}
                    title={r.name}
                    onPress={() => {
                      updateSettings((s) => ({ ...s, listen: { ...s.listen, wirdReciter: r.id } }));
                      setChoosing(false);
                    }}
                    trailing={listen.wirdReciter === r.id ? <Check size={16} color={colors.primary} /> : <View />}
                    last={i === AYAH_RECITERS.length - 1}
                  />
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </Card>

      {recent.length ? (
        <>
          <SectionTitle>استمعت مؤخرًا</SectionTitle>
          <Card padded={false} style={{ overflow: "hidden" }}>
            {recent.map((r, i) => (
              <ListRow
                key={r.key}
                icon={r.track.kind === "radio" ? RadioIcon : Headphones}
                title={r.track.kind === "radio" ? r.track.name : `سورة ${surahName(r.track.surah)}`}
                note={r.track.kind === "radio" ? "بث مباشر" : r.track.reciter}
                onPress={() => player.play(r.track)}
                trailing={<Play size={16} color={colors.mutedForeground} />}
                last={i === recent.length - 1}
              />
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>المفضّلة</SectionTitle>
      {favReciters.length || favStations.length ? (
        <Card padded={false} style={{ overflow: "hidden" }}>
          {favReciters.map((r, i) => (
            <ListRow
              key={`r${r.id}`}
              icon={Star}
              title={r.name}
              note={r.moshaf.length > 1 ? `${n(r.moshaf.length)} روايات` : r.moshaf[0]?.name}
              onPress={() => router.push({ pathname: "/recitations/[id]", params: { id: String(r.id) } })}
              last={i === favReciters.length - 1 && !favStations.length}
            />
          ))}
          {favStations.map((s, i) => (
            <ListRow
              key={`s${s.id}`}
              icon={RadioIcon}
              title={s.name}
              note="إذاعة"
              onPress={() => {
                const t = stationTrack(s.id);
                if (t) player.play(t);
              }}
              trailing={<Play size={16} color={colors.mutedForeground} />}
              last={i === favStations.length - 1}
            />
          ))}
        </Card>
      ) : (
        <Card>
          <T size={14} color="mutedForeground">
            اضغط النجمة بجانب قارئ أو إذاعة لتجدها هنا.
          </T>
        </Card>
      )}

      <Row style={{ flexWrap: "wrap" }}>
        <Pressable onPress={() => router.push("/recitations")} accessibilityRole="link">
          <Row gap={4}>
            <T size={14} color="primary">
              كل القرّاء
            </T>
            <ChevronLeft size={14} color={colors.primary} />
          </Row>
        </Pressable>
        <Pressable onPress={() => router.push("/radio")} accessibilityRole="link" style={{ marginStart: 16 }}>
          <Row gap={4}>
            <T size={14} color="primary">
              كل الإذاعات
            </T>
            <ChevronLeft size={14} color={colors.primary} />
          </Row>
        </Pressable>
      </Row>
    </Screen>
  );
}
