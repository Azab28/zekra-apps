/**
 * A shared khatma or «صدقة جارية» page's body, as the site's RoomApp (/k/<slug>,
 * /ali): the round's progress and sharing, a memorial's counters (taps through
 * src/lib/room-sync.ts, sent in batches), `beforeParts` (/ali puts the dua
 * posters there), and the 30 juz (tap a free one to take it, again when
 * finished; read it in the mushaf, or give it back). Refreshed every 15 s.
 */
import { router } from "expo-router";
import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { AppState, Linking, Pressable, Share, TextInput, View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import type { RoomView } from "@lib/khatma-room";
import { RoomSync } from "@lib/room-sync";
import { juzStarts } from "@/core/quran";
import { roomCall, roomUrl, saveName, savedName, setGroupReading } from "@/core/rooms";
import { START } from "@/theme/rtl";
import { useTheme } from "@/theme/theme";
import { BookOpen, BookOpenText, Check, CircleCheck, Flower2, HandHeart, Hourglass, Image as ImageIcon, Share2, Sparkles, UserRound } from "./icons";
import { Button, Card, Row, T } from "./ui";

const n = toArabicDigits;
const POLL_MS = 15_000;

const COUNTERS = [
  { key: "tasbeeh", label: "سبّحت", Icon: Sparkles },
  { key: "istighfar", label: "استغفرت", Icon: HandHeart },
  { key: "salawat", label: "صلّيت على النبي ﷺ", Icon: Flower2 },
  { key: "surahs", label: "قرأت سورة", Icon: BookOpenText },
] as const;

/** Reads a room by its slug: its first view, null while loading, or why it can't be shown. */
export function useRoom(slug: string): RoomView | null | "missing" | "offline" {
  const [view, setView] = useState<RoomView | null | "missing" | "offline">(null);
  useEffect(() => {
    let alive = true;
    void roomCall({ action: "get", slug }).then((r) => {
      if (alive) setView(r?.view ?? (r ? "missing" : "offline"));
    });
    return () => {
      alive = false;
    };
  }, [slug]);
  return view;
}

export function Room({ initial, beforeParts }: { initial: RoomView; beforeParts?: ReactNode }) {
  const { colors } = useTheme();
  const [, changed] = useReducer((x: number) => x + 1, 0);
  const [sync] = useState(() => new RoomSync(initial, { send: (body) => roomCall(body), changed }));
  const view = sync.view;
  const counts = sync.counts();
  const [asking, setAsking] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const tapping = useRef(new Set<number>());

  useEffect(() => {
    sync.open();
    const reload = async () => sync.apply((await roomCall({ action: "get", slug: sync.view.slug }))?.view);
    const t = setInterval(() => AppState.currentState === "active" && void reload(), POLL_MS);
    // Back in the app: the latest now. Leaving it: taps go out first.
    const sub = AppState.addEventListener("change", (s) => (s === "active" ? void reload() : sync.flush(true)));
    return () => {
      clearInterval(t);
      sub.remove();
      sync.close();
    };
  }, [sync]);

  const byJuz = new Map(view.parts.map((p) => [p.juz, p]));
  const tell = (text: string, bad = false) => setNote({ text, bad });

  const tap = async (juz: number, release = false) => {
    // A second tap before the first is answered would take the juz and mark it done at once.
    if (tapping.current.has(juz)) return;
    const part = byJuz.get(juz);
    if (part && !part.mine) return tell(`الجزء ${n(juz)} محجوز لـ${part.name}. اختر جزءًا آخر.`);
    if (!part && !(await savedName())) return setAsking(juz);
    tapping.current.add(juz);
    const r = await roomCall({ action: release ? "release" : "tap", slug: view.slug, juz }).finally(() => tapping.current.delete(juz));
    if (!r) return tell("تعذّر الاتصال، حاول مرة أخرى", true);
    sync.apply(r.view);
    if (r.error === "rate_limited") return tell(r.message ?? "طلبات كثيرة، حاول بعد قليل", true);
    if (!r.ok) return tell(r.error === "taken_by_other" ? `سبقك ${r.takerName ?? "غيرك"} إلى هذا الجزء` : "لا يمكن الآن", true);
    if (r.finishedRound) tell("تمت الختمة! تقبّل الله من الجميع. بدأت ختمة جديدة.");
    else if (release) tell(`أُعيد الجزء ${n(juz)}`);
    else if (!part) tell(`حجزت الجزء ${n(juz)}. اضغطه مرة أخرى عند إتمامه.`);
    else if (part.done) tell(`أُعيد الجزء ${n(juz)} إلى «محجوز»`);
    else tell(`أتممت الجزء ${n(juz)}، تقبّل الله منك`);
  };

  const shareText = view.kind === "memorial" ? `${view.heading}: اقرأ جزءًا أو سبّح أو استغفر، ويُحتسب له الأجر إن شاء الله` : `${view.heading}: احجز جزءًا واقرأه معنا`;
  const url = roomUrl(view.slug);
  const p = view.progress;
  const juzPage = (juz: number) => juzStarts()[juz - 1]?.page ?? 1;

  return (
    <>
      <Card style={{ gap: 10, alignItems: "center" }}>
        <T size={20} weight="bold" align="center">
          {view.heading}
        </T>
        {view.round > 1 ? (
          <T size={13} color="mutedForeground">
            الختمة {n(view.round)} · أُتمّت قبلها {n(view.round - 1)}
          </T>
        ) : null}
        <View style={{ alignSelf: "stretch", height: 10, borderRadius: 5, backgroundColor: colors.muted, overflow: "hidden" }}>
          <View style={{ height: 10, width: `${(p.done / 30) * 100}%`, backgroundColor: colors.primary }} />
        </View>
        <T size={13} color="mutedForeground">
          تم {n(p.done)} من ٣٠ جزءًا · محجوز {n(p.taken)} · متاح {n(p.free)}
        </T>
        <Row>
          <Button label="شارك الرابط" icon={Share2} size="sm" onPress={() => void Share.share({ message: `${shareText}\n${url}` })} />
          <Button
            label="واتساب"
            size="sm"
            variant="outline"
            onPress={() => void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`${view.heading}\n${url}`)}`).catch(() => undefined)}
          />
        </Row>
      </Card>

      {view.honoree && !beforeParts ? (
        <Pressable
          onPress={() => router.push({ pathname: "/dua-poster", params: { name: view.honoree!.name, f: view.honoree!.female ? "1" : "0" } })}
          accessibilityRole="button"
          style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, padding: 12 }}
        >
          <ImageIcon size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <T size={14} weight="medium">
              بوستر دعاء {view.honoree.female ? "لها" : "له"}
            </T>
            <T size={12} color="mutedForeground">
              صورة بالدعاء باسمه{view.honoree.female ? "ا" : ""}، تحفظها وترسلها لمن يدعو.
            </T>
          </View>
        </Pressable>
      ) : null}

      {view.kind === "memorial" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {COUNTERS.map((c) => (
            <Pressable
              key={c.key}
              onPress={() => sync.tap(c.key)}
              accessibilityRole="button"
              accessibilityLabel={c.label}
              style={({ pressed }) => ({ width: "47%", flexGrow: 1, alignItems: "center", gap: 2, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.muted : colors.card, padding: 14, transform: [{ scale: pressed ? 0.98 : 1 }] })}
            >
              <c.Icon size={22} color={colors.primary} />
              <T size={22} weight="bold">
                {n(counts[c.key])}
              </T>
              <T size={12} color="mutedForeground" align="center">
                {c.label}
              </T>
            </Pressable>
          ))}
        </View>
      ) : null}

      {beforeParts}

      {note ? (
        <Row gap={6} style={{ backgroundColor: note.bad ? colors.muted : colors.accent, borderRadius: 12, padding: 10 }}>
          {note.bad ? null : <CircleCheck size={16} color={colors.primary} />}
          <T size={13} color={note.bad ? "destructive" : "foreground"} style={{ flex: 1 }}>
            {note.text}
          </T>
        </Row>
      ) : null}

      {asking !== null ? (
        <Card style={{ gap: 8, borderColor: colors.primary }}>
          <T size={14} weight="medium">
            اسمك (يظهر بجانب الجزء الذي تحجزه):
          </T>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={40}
            autoFocus
            placeholderTextColor={colors.mutedForeground}
            style={{ height: 44, borderRadius: 12, backgroundColor: colors.muted, paddingHorizontal: 12, color: colors.foreground, fontFamily: "Plex-Regular", fontSize: 15, textAlign: START }}
          />
          <Button
            label={`حجز الجزء ${n(asking)}`}
            disabled={name.trim().length < 2}
            onPress={async () => {
              await saveName(name);
              const juz = asking;
              setAsking(null);
              await tap(juz);
            }}
          />
        </Card>
      ) : null}

      <Row style={{ justifyContent: "space-between" }}>
        <T weight="semibold">الأجزاء</T>
        <T size={12} color="mutedForeground">
          اضغط جزءًا لتحجزه، ثم اضغطه عند إتمامه
        </T>
      </Row>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => {
          const part = byJuz.get(juz);
          const bg = part?.done ? colors.accent : part ? (part.mine ? "rgba(201,162,78,0.15)" : colors.muted) : colors.card;
          return (
            <View key={juz} style={{ width: "31%", flexGrow: 1, borderRadius: 16, borderWidth: 1, borderColor: part?.done ? colors.primary : part?.mine ? colors.gold : colors.border, backgroundColor: bg, padding: 8 }}>
              <Pressable onPress={() => void tap(juz)} accessibilityRole="button" accessibilityLabel={`الجزء ${juz}`} style={{ alignItems: "center", gap: 2 }}>
                <T size={15} weight="bold">
                  الجزء {n(juz)}
                </T>
                <Row gap={3}>
                  {part?.done ? <Check size={12} color={colors.primary} /> : part ? <Hourglass size={12} color={colors.mutedForeground} /> : <UserRound size={12} color={colors.mutedForeground} />}
                  <T size={11} color="mutedForeground" lines={1} style={{ maxWidth: 80 }}>
                    {part ? part.name : "متاح"}
                  </T>
                </Row>
              </Pressable>
              {part?.mine ? (
                <Row gap={10} style={{ justifyContent: "center", borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6, paddingTop: 4 }}>
                  <Pressable
                    onPress={() => {
                      // The mushaf shows this juz as the one being read, with «أتممت الجزء» there.
                      if (!part.done) void setGroupReading({ slug: view.slug, juz, heading: view.heading, from: juzPage(juz), to: juz < 30 ? juzPage(juz + 1) - 1 : 604 });
                      router.push({ pathname: "/mushaf/[page]", params: { page: String(juzPage(juz)) } });
                    }}
                    accessibilityRole="button"
                  >
                    <Row gap={2}>
                      <BookOpen size={12} color={colors.primary} />
                      <T size={11} color="primary">
                        اقرأ
                      </T>
                    </Row>
                  </Pressable>
                  {!part.done ? (
                    <Pressable onPress={() => void tap(juz, true)} accessibilityRole="button">
                      <T size={11} color="mutedForeground">
                        إلغاء
                      </T>
                    </Pressable>
                  ) : null}
                </Row>
              ) : null}
            </View>
          );
        })}
      </View>
      {view.inTelegramGroup ? (
        <T size={12} color="mutedForeground" align="center">
          هذه الختمة مرتبطة بمجموعة على تيليجرام، وتظهر فيها التحديثات أيضًا.
        </T>
      ) : null}
    </>
  );
}
