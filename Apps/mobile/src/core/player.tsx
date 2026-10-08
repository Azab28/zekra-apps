/**
 * One player for the whole app, as the site's (src/components/site/player.tsx):
 * a whole surah from a reciter on mp3quran.net (going on to the next surah of
 * that recitation), a live station (its «now playing» from the site's
 * /api/radio/[id]), or the mushaf ayah by ayah from everyayah.com (the
 * basmala before each surah but Al-Fatiha and At-Tawbah). It keeps playing
 * in the background and shows on the lock screen (expo-audio). A surah left
 * halfway continues where it was, and «كرّر السورة» plays it again.
 */
import { createAudioPlayer, requestNotificationPermissionsAsync, setAudioModeAsync, type AudioPlayer, type AudioStatus } from "expo-audio";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { AYAH_TOTAL, ayahAudioUrl, ayahReciter, basmalaAudioUrl } from "@lib/ayah-audio";
import { localSurahUri } from "./downloads";
import { rememberPlayed, wirdAt, wirdDone } from "./listen";
import { readJson, writeJson } from "./storage";
import { ayahAt, surahName } from "./quran";
import { siteJson } from "./site";

export type SurahTrack = { kind: "surah"; reciter: string; moshaf: string; server: string; surahs: number[]; surah: number; reciterId: number; moshafId: number };
export type RadioTrack = { kind: "radio"; id: number; name: string; url: string };
/**
 * `basmala`: the basmala recited before the surah that `index` starts.
 * `loop` (memorizing): the ayat from..to played `times` times (0 = until
 * stopped); `round` counts from 1. Without it the mushaf goes on to the end.
 */
export type AyahTrack = {
  kind: "ayah";
  reciter: string;
  index: number;
  basmala: boolean;
  loop?: { from: number; to: number; times: number; round: number };
  /** The listening wird (core/listen.ts): where it is is kept as it plays. */
  wird?: boolean;
};
export type Track = SurahTrack | RadioTrack | AyahTrack;

const pad = (n: number) => String(n).padStart(3, "0");

function urlOf(t: Track): string {
  // A surah saved on the device plays from its file (offline).
  if (t.kind === "surah") return localSurahUri(t.moshafId, t.surah) ?? `${t.server}${pad(t.surah)}.mp3`;
  if (t.kind === "radio") return t.url;
  if (t.basmala) return basmalaAudioUrl(t.reciter);
  const a = ayahAt(t.index);
  return ayahAudioUrl(t.reciter, a.surah, a.ayah);
}

/** A surah's first ayah gets the basmala before it, except Al-Fatiha (its first ayah is the basmala) and At-Tawbah. */
const needsBasmala = (index: number) => {
  const a = ayahAt(index);
  return a.ayah === 1 && a.surah !== 1 && a.surah !== 9;
};

/** The ayah track starting at `index` (with its surah's basmala first when it opens one). */
export const ayahTrack = (reciter: string, index: number): AyahTrack => ({ kind: "ayah", reciter, index, basmala: needsBasmala(index) });

/** The ayat from..to, `times` times over (0 = until stopped), for memorizing: the basmala only before the first round. */
export const ayahLoop = (reciter: string, from: number, to: number, times: number): AyahTrack => ({
  ...ayahTrack(reciter, from),
  loop: { from, to: Math.max(from, to), times: Math.max(0, Math.floor(times)), round: 1 },
});

function nextOf(t: Track): Track | null {
  if (t.kind === "surah") {
    const i = t.surahs.indexOf(t.surah);
    return i >= 0 && i < t.surahs.length - 1 ? { ...t, surah: t.surahs[i + 1] } : null;
  }
  if (t.kind === "ayah") {
    if (t.basmala) return { ...t, basmala: false };
    const l = t.loop;
    if (l && t.index >= l.to) {
      // The range again, unless that was the last round.
      return l.times === 0 || l.round < l.times ? { ...t, index: l.from, basmala: false, loop: { ...l, round: l.round + 1 } } : null;
    }
    return t.index + 1 < AYAH_TOTAL ? { ...ayahTrack(t.reciter, t.index + 1), loop: l, wird: t.wird } : null;
  }
  return null;
}

function prevOf(t: Track): Track | null {
  if (t.kind === "surah") {
    const i = t.surahs.indexOf(t.surah);
    return i > 0 ? { ...t, surah: t.surahs[i - 1] } : null;
  }
  if (t.kind === "ayah") return t.index > (t.loop?.from ?? 0) ? { ...t, index: t.index - 1, basmala: false } : null;
  return null;
}

/** What the player shows (and the lock screen). */
export function describe(t: Track, live: string | null): { title: string; subtitle: string } {
  if (t.kind === "surah") return { title: `سورة ${surahName(t.surah)}`, subtitle: `${t.reciter} · ${t.moshaf}` };
  if (t.kind === "radio") return { title: t.name, subtitle: live ?? "بث مباشر" };
  const a = ayahAt(t.index);
  const round = t.loop && t.loop.times !== 1 ? ` · التكرار ${t.loop.round}${t.loop.times ? ` من ${t.loop.times}` : ""}` : "";
  return { title: t.basmala ? `سورة ${a.surahName} · البسملة` : `سورة ${a.surahName} · الآية ${a.ayah}${round}`, subtitle: ayahReciter(t.reciter).name };
}

export const RATES = [0.75, 1, 1.25, 1.5];
/** Sleep timer: minutes, or the end of what's playing now. */
export type Sleep = { kind: "minutes"; at: number } | { kind: "end" } | null;

type Status = { playing: boolean; buffering: boolean; position: number; duration: number; error: string | null };

type Player = {
  track: Track | null;
  /** «كرّر السورة»: a surah plays again instead of going on (kept on the device). */
  loopSurah: boolean;
  setLoopSurah: (on: boolean) => void;
  /** Where a surah left halfway was resumed from (seconds), for «من البداية» right after. */
  resumedAt: number | null;
  status: Status;
  /** The live station's current title, read from the site. */
  live: string | null;
  rate: number;
  sleep: Sleep;
  play: (t: Track) => void;
  toggle: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setRate: (r: number) => void;
  setSleep: (s: Sleep) => void;
  hasNext: boolean;
  hasPrev: boolean;
};

const PlayerContext = createContext<Player | null>(null);

/** Android 13+ shows the playback controls in the notification shade only with this permission: asked once, on the first play. */
let askedNotifications = false;
function askForControls() {
  if (Platform.OS !== "android" || askedNotifications) return;
  askedNotifications = true;
  void requestNotificationPermissionsAsync().catch(() => undefined);
}
const IDLE: Status = { playing: false, buffering: false, position: 0, duration: 0, error: null };

/**
 * Where each surah was left (per recitation), as the site's `site:resume`, so
 * coming back to it continues from the same second; the latest 60 are kept.
 */
type Resume = Record<string, { at: number; t: number }>;
const RESUME_KEY = "player:resume";
const RESUME_MAX = 60;
const resumeKey = (t: SurahTrack) => `${t.moshafId}|${t.surah}`;
let resume: Resume = {};
void readJson<Resume>(RESUME_KEY).then((r) => {
  if (r && typeof r === "object") resume = { ...r, ...resume };
});
function saveResume(key: string, at: number | null) {
  if (at === null) delete resume[key];
  else resume[key] = { at: Math.floor(at), t: Date.now() };
  resume = Object.fromEntries(
    Object.entries(resume)
      .sort((a, b) => b[1].t - a[1].t)
      .slice(0, RESUME_MAX),
  );
  void writeJson(RESUME_KEY, resume);
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const ref = useRef<AudioPlayer | null>(null);
  const trackRef = useRef<Track | null>(null);
  const sleepRef = useRef<Sleep>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [status, setStatus] = useState<Status>(IDLE);
  const [live, setLive] = useState<string | null>(null);
  const [rate, setRateState] = useState(1);
  const [sleep, setSleepState] = useState<Sleep>(null);
  const rateRef = useRef(1);
  const [loopSurah, setLoopState] = useState(false);
  const loopRef = useRef(false);
  const [resumedAt, setResumedAt] = useState<number | null>(null);
  /** A surah to continue from this second once it has loaded. */
  const pendingSeek = useRef<number | null>(null);
  const lastSave = useRef(0);

  useEffect(() => {
    void readJson<boolean>("player:loop").then((v) => {
      loopRef.current = v === true;
      setLoopState(v === true);
    });
  }, []);

  const start = useCallback((t: Track | null) => {
    const p = ref.current;
    if (!p) return;
    trackRef.current = t;
    setTrack(t);
    if (!t) {
      p.pause();
      p.clearLockScreenControls();
      setStatus(IDLE);
      return;
    }
    askForControls();
    void rememberPlayed(t);
    if (t.kind === "ayah" && t.wird && !t.basmala) void wirdAt(t.index);
    setResumedAt(null);
    const saved = t.kind === "surah" ? resume[resumeKey(t)] : undefined;
    pendingSeek.current = saved && saved.at > 15 ? saved.at : null;
    p.replace({ uri: urlOf(t) });
    if (t.kind !== "radio") p.setPlaybackRate(rateRef.current);
    p.play();
    const d = describe(t, null);
    p.setActiveForLockScreen(true, { title: d.title, artist: d.subtitle, albumTitle: "ذِكرى" }, { isLiveStream: t.kind === "radio" });
  }, []);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: "doNotMix" }).catch(() => undefined);
    const p = createAudioPlayer(null, { updateInterval: 500 });
    ref.current = p;
    const sub = p.addListener("playbackStatusUpdate", (s: AudioStatus) => {
      setStatus({ playing: s.playing, buffering: s.isBuffering, position: s.currentTime, duration: s.duration, error: s.error });
      const cur = trackRef.current;
      if (cur?.kind === "surah") {
        // Back to a surah left halfway: on from the same second.
        const at = pendingSeek.current;
        if (at !== null && s.isLoaded && s.duration > 0) {
          pendingSeek.current = null;
          if (at < s.duration - 15) {
            void p.seekTo(at);
            setResumedAt(at);
          }
        }
        if (s.playing && s.duration > 120 && Date.now() - lastSave.current > 5000) {
          lastSave.current = Date.now();
          saveResume(resumeKey(cur), s.currentTime);
        }
        if (s.didJustFinish) saveResume(resumeKey(cur), null);
      }
      if (!s.didJustFinish) return;
      if (sleepRef.current?.kind === "end") {
        sleepRef.current = null;
        setSleepState(null);
        return start(null);
      }
      if (cur?.kind === "surah" && loopRef.current) return start(cur);
      const next = cur ? nextOf(cur) : null;
      // The wird's juz heard to its end.
      if (!next && cur?.kind === "ayah" && cur.wird) void wirdDone(cur.index);
      start(next);
    });
    return () => {
      sub.remove();
      p.remove();
      ref.current = null;
    };
  }, [start]);

  // The live station's «now playing», every 30 s while it plays.
  useEffect(() => {
    setLive(null);
    if (track?.kind !== "radio") return;
    let alive = true;
    const read = () =>
      void siteJson<{ title: string | null; surah: string | null }>(`/api/radio/${track.id}`)
        .then((r) => {
          if (!alive) return;
          const text = r.surah ? `سورة ${r.surah}` : r.title;
          setLive(text);
          if (text) ref.current?.updateLockScreenMetadata({ title: track.name, artist: text, albumTitle: "ذِكرى" });
        })
        .catch(() => undefined);
    read();
    const t = setInterval(read, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [track]);

  // Sleep after some minutes.
  useEffect(() => {
    sleepRef.current = sleep;
    if (sleep?.kind !== "minutes") return;
    const t = setTimeout(() => {
      ref.current?.pause();
      setSleepState(null);
    }, Math.max(0, sleep.at - Date.now()));
    return () => clearTimeout(t);
  }, [sleep]);

  const value = useMemo<Player>(
    () => ({
      track,
      status,
      live,
      rate,
      sleep,
      play: start,
      loopSurah,
      setLoopSurah: (on) => {
        loopRef.current = on;
        setLoopState(on);
        void writeJson("player:loop", on);
      },
      resumedAt,
      toggle: () => {
        const p = ref.current;
        if (!p || !trackRef.current) return;
        if (p.playing) {
          p.pause();
          const cur = trackRef.current;
          if (cur.kind === "surah" && p.duration > 120) saveResume(resumeKey(cur), p.currentTime);
        } else p.play();
      },
      stop: () => {
        setSleepState(null);
        start(null);
      },
      next: () => {
        const n = trackRef.current && nextOf(trackRef.current);
        if (n) start(n);
      },
      prev: () => {
        const n = trackRef.current && prevOf(trackRef.current);
        if (n) start(n);
      },
      seek: (seconds) => void ref.current?.seekTo(Math.max(0, seconds)),
      setRate: (r) => {
        rateRef.current = r;
        setRateState(r);
        if (trackRef.current?.kind !== "radio") ref.current?.setPlaybackRate(r);
      },
      setSleep: setSleepState,
      hasNext: !!track && !!nextOf(track),
      hasPrev: !!track && !!prevOf(track),
    }),
    [track, status, live, rate, sleep, start, loopSurah, resumedAt],
  );
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): Player {
  const p = useContext(PlayerContext);
  if (!p) throw new Error("usePlayer outside PlayerProvider");
  return p;
}

/** The ayah being recited now (not during a basmala), for highlighting it in the mushaf. */
export function useAyahOnAir(): number | null {
  const { track, status } = usePlayer();
  return track?.kind === "ayah" && !track.basmala && (status.playing || status.buffering) ? track.index : null;
}
