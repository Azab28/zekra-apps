/**
 * An ayah's panel, as the site's (src/components/site/ayah-panel.tsx): its
 * text (Tanzil Uthmani, data/quran.json) with التفسير الميسر (data/
 * tafsir-muyassar.json) and the site's other tafsirs; listening once,
 * repeated for memorizing, or on from here; its words one by one (quran.com
 * word audio); copy, share, an image or a wallpaper; its surah or mushaf
 * page; a report; and the previous/next ayah of `ayat` (the page's or the
 * surah's).
 */
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Share, View } from "react-native";
import { AYAH_RECITERS, ayahReciter, wordAudioUrl } from "@lib/ayah-audio";
import { toArabicDigits } from "@lib/content/arabic";
import { qcf, tafsirMuyassar } from "@lib/content/data";
import { mushafPageOf } from "@lib/content/mushaf-pages";
import { TAFSIR_SOURCES } from "@lib/tafsir-sources";
import { ayahLoop, ayahTrack, usePlayer } from "@/core/player";
import { shareImage, type ImageKind } from "@/core/images";
import { ayahAt } from "@/core/quran";
import { SITE_URL } from "@/core/site";
import { useStore } from "@/core/store";
import { QURAN_FONT } from "@/theme/fonts";
import { useTheme } from "@/theme/theme";
import { FeedbackForm } from "./feedback-form";
import { BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Flag, Image as ImageIcon, Play, Repeat, Share2, Smartphone, UserRound, Volume2 } from "./icons";
import { Sheet } from "./sheet";
import { Button, IconButton, ListRow, Row, T } from "./ui";

const n = toArabicDigits;

/** How many times «استمع» plays the ayah (0 = until stopped), for memorizing. */
const REPEATS = [1, 3, 5, 10, 0];
const repeatLabel = (r: number) => (r === 0 ? "مستمر" : r === 1 ? "مرة" : `${n(r)} مرات`);

/**
 * A Tanzil ayah's pieces, each word with its sound's number (the files count
 * words only); standalone pause marks are pieces too, without a sound.
 */
function piecesOf(text: string) {
  let words = 0;
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      const word = /[ء-يٱ-ۓ]/.test(t);
      return { text: t, position: word ? ++words : 0, word };
    });
}

/** The mushaf glyphs of an ayah (its words, then its number), to check the two editions split it the same way. */
const glyphCount = (surah: number, ayah: number) => (qcf().verses[`${surah}:${ayah}`] ?? []).reduce((sum, [, , codes]) => sum + [...codes].length, 0);

export function AyahPanel({
  index,
  ayat,
  onChange,
  from,
}: {
  index: number | null;
  ayat: number[];
  onChange: (index: number | null) => void;
  /** The screen it's opened on: the other one is offered. */
  from: "mushaf" | "surah";
}) {
  const { colors } = useTheme();
  const { settings, updateSettings } = useStore();
  const player = usePlayer();
  const [repeat, setRepeat] = useState(1);
  const [reciters, setReciters] = useState(false);
  const [word, setWord] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<ImageKind | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const wordPlayer = useRef<AudioPlayer | null>(null);

  const a = index != null ? ayahAt(index) : null;
  const at = index != null ? ayat.indexOf(index) : -1;
  const pieces = a ? piecesOf(a.text) : [];
  // About 94% of ayat split the same way in both editions; otherwise no word sounds rather than wrong ones.
  const wordAudio = !!a && glyphCount(a.surah, a.ayah) - 1 === pieces.length;
  const reference = a ? `[${a.surahName}: ${n(a.ayah)}]` : "";
  const title = a ? `سورة ${a.surahName}، الآية ${n(a.ayah)}` : "";

  // A new ayah: start fresh.
  useEffect(() => {
    setWord(null);
    setImageError(null);
    setReporting(false);
    wordPlayer.current?.pause();
  }, [index]);

  useEffect(
    () => () => {
      wordPlayer.current?.remove();
      wordPlayer.current = null;
    },
    [],
  );

  const sayWord = (position: number) => {
    if (!a) return;
    let p = wordPlayer.current;
    if (!p) {
      p = createAudioPlayer(null);
      p.addListener("playbackStatusUpdate", (s) => {
        if (s.didJustFinish) setWord(null);
      });
      wordPlayer.current = p;
    }
    p.replace({ uri: wordAudioUrl(a.surah, a.ayah, position) });
    p.play();
    setWord(position);
  };

  const image = async (kind: ImageKind) => {
    if (!a || busy) return;
    setBusy(kind);
    setImageError(null);
    setImageError(await shareImage({ ayah: a.index }, kind, settings.imageStyle, title));
    setBusy(null);
  };

  const close = () => onChange(null);

  return (
    <Sheet open={index != null} onClose={close} title={title}>
      {a ? (
        <View style={{ gap: 14 }}>
          <T size={24} style={{ fontFamily: QURAN_FONT, lineHeight: 52 }} selectable>
            {a.text} ﴿{n(a.ayah)}﴾
          </T>

          {/* Listening */}
          <View style={{ gap: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12 }}>
            <Row style={{ flexWrap: "wrap" }}>
              <Button label="استمع" icon={Volume2} size="sm" onPress={() => player.play(ayahLoop(settings.reciter, a.index, a.index, repeat))} />
              <Button
                label="من هنا"
                icon={Play}
                size="sm"
                variant="outline"
                onPress={() => {
                  player.play(ayahTrack(settings.reciter, a.index));
                  close();
                }}
              />
            </Row>
            <Row gap={6} style={{ flexWrap: "wrap" }}>
              <Repeat size={15} color={colors.mutedForeground} />
              {REPEATS.map((r) => (
                <Chip key={r} label={repeatLabel(r)} on={repeat === r} onPress={() => setRepeat(r)} />
              ))}
            </Row>
            <Pressable onPress={() => setReciters((v) => !v)} accessibilityRole="button" accessibilityLabel="القارئ">
              <Row gap={6}>
                <UserRound size={15} color={colors.mutedForeground} />
                <T size={13} style={{ flex: 1 }} lines={1}>
                  {ayahReciter(settings.reciter).name}
                </T>
                <ChevronDown size={16} color={colors.mutedForeground} />
              </Row>
            </Pressable>
            {reciters ? (
              <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
                {AYAH_RECITERS.map((r, i) => (
                  <ListRow
                    key={r.id}
                    title={r.name}
                    last={i === AYAH_RECITERS.length - 1}
                    onPress={() => {
                      updateSettings((s) => ({ ...s, reciter: r.id }));
                      setReciters(false);
                    }}
                    trailing={settings.reciter === r.id ? <Check size={18} color={colors.primary} /> : <View />}
                  />
                ))}
              </View>
            ) : null}
            {wordAudio ? (
              <View style={{ gap: 6 }}>
                <T size={12} color="mutedForeground">
                  اضغط على كلمة لسماع نطقها:
                </T>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {pieces
                    .filter((p) => p.word)
                    .map((p) => (
                      <Pressable
                        key={p.position}
                        onPress={() => sayWord(p.position)}
                        accessibilityRole="button"
                        style={{
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: word === p.position ? colors.primary : colors.border,
                          backgroundColor: word === p.position ? colors.accent : colors.card,
                          paddingHorizontal: 8,
                        }}
                      >
                        <T size={19} style={{ fontFamily: QURAN_FONT, lineHeight: 38 }}>
                          {p.text}
                        </T>
                      </Pressable>
                    ))}
                </View>
              </View>
            ) : null}
          </View>

          {/* Tafsir */}
          <View style={{ gap: 8, borderRadius: 16, backgroundColor: colors.muted, padding: 12 }}>
            <T size={12} weight="semibold" color="primary">
              التفسير الميسر
            </T>
            <T size={15} selectable>
              {tafsirMuyassar()[a.index]}
            </T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
              <T size={12} color="mutedForeground">
                تفاسير أخرى:
              </T>
              {TAFSIR_SOURCES.map((t) => (
                <Pressable
                  key={t.id}
                  accessibilityRole="link"
                  onPress={() => void WebBrowser.openBrowserAsync(`${SITE_URL}/surah/${a.surah}/tafsir/${t.id}?ayah=${a.ayah}`, { toolbarColor: colors.card, controlsColor: colors.primary })}
                >
                  <T size={13} color="primary">
                    {t.name.replace(/^تفسير /, "")}
                  </T>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Actions */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button
              label={copied ? "نُسخت" : "نسخ"}
              icon={copied ? Check : Copy}
              size="sm"
              variant="outline"
              onPress={async () => {
                await Clipboard.setStringAsync(`﴿ ${a.text} ﴾\n${reference}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            />
            <Button
              label="مشاركة"
              icon={Share2}
              size="sm"
              variant="outline"
              onPress={() => void Share.share({ message: `﴿ ${a.text} ﴾ ${reference}\n${SITE_URL}/surah/${a.surah}#${a.ayah}` })}
            />
            <Button label={busy === "image" ? "جارٍ التجهيز…" : "صورة"} icon={ImageIcon} size="sm" variant="outline" disabled={!!busy} onPress={() => void image("image")} />
            <Button label={busy === "wallpaper" ? "جارٍ التجهيز…" : "خلفية"} icon={Smartphone} size="sm" variant="outline" disabled={!!busy} onPress={() => void image("wallpaper")} />
            {from === "mushaf" ? (
              <Button
                label="السورة"
                icon={BookOpen}
                size="sm"
                variant="outline"
                onPress={() => {
                  close();
                  router.push({ pathname: "/surah/[n]", params: { n: String(a.surah), ayah: String(a.ayah) } });
                }}
              />
            ) : (
              <Button
                label="في المصحف"
                icon={BookOpen}
                size="sm"
                variant="outline"
                onPress={() => {
                  close();
                  router.push({ pathname: "/mushaf/[page]", params: { page: String(mushafPageOf(a.index)), ayah: String(a.index) } });
                }}
              />
            )}
            <Button label="بلّغ عن خطأ" icon={Flag} size="sm" variant="ghost" onPress={() => setReporting((v) => !v)} />
          </View>
          {busy ? <ActivityIndicator color={colors.primary} /> : null}
          {imageError ? (
            <T size={13} color="destructive">
              {imageError}
            </T>
          ) : null}
          {reporting ? (
            <FeedbackForm
              context={{ type: "ayah", ref: `${a.surah}:${a.ayah}`, label: `سورة ${a.surahName}: ${n(a.ayah)}`, url: `/surah/${a.surah}` }}
              onDone={() => setReporting(false)}
            />
          ) : null}

          <Row style={{ justifyContent: "space-between" }}>
            <IconButton icon={ChevronRight} label="الآية السابقة" disabled={at <= 0} onPress={() => onChange(ayat[at - 1])} />
            <T size={12} color="mutedForeground">
              {at >= 0 ? `${n(at + 1)} من ${n(ayat.length)}` : ""}
            </T>
            <IconButton icon={ChevronLeft} label="الآية التالية" disabled={at < 0 || at >= ayat.length - 1} onPress={() => onChange(ayat[at + 1])} />
          </Row>
        </View>
      ) : null}
    </Sheet>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={{ borderRadius: 999, borderWidth: 1, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card, paddingHorizontal: 10, paddingVertical: 3 }}
    >
      <T size={12} color={on ? "primaryForeground" : "foreground"}>
        {label}
      </T>
    </Pressable>
  );
}
