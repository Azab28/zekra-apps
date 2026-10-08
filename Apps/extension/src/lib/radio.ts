/**
 * The player: a live station, a recorded surah (mp3quran.net, going on to the
 * next surah), or the listening wird (ayah by ayah from everyayah.com up to the
 * end of the juz). The pages ask the background, which plays it in an
 * offscreen document so it keeps going with every tab and popup closed. The
 * state lives in chrome.storage.local for every page to follow.
 */
import { ayahReciter } from "../../../../src/lib/ayah-audio";
import { ayahAt, juzOf, SURAHS } from "./quran";
import { moshafById, moshafLabel } from "./reciters";
import type { ExtStation } from "./types";

export type RadioStatus = "stopped" | "loading" | "playing" | "error";

export type Track =
  | { kind: "live"; id: number }
  /** From this surah on through the recitation (`surah` follows what's playing). */
  | { kind: "surah"; moshaf: number; surah: number }
  /** The wird: `ayah` is the one playing, `end` the last of the juz. */
  | { kind: "wird"; reciter: string; ayah: number; end: number };

/** Stop after so long (`at`), or at the end of the surah playing. */
export type Sleep = { at: number } | { surahEnd: true; title?: string | null } | null;

export type RadioState = { track: Track | null; status: RadioStatus; volume: number; sleep: Sleep };

/** Where the recording is (written every few seconds; `at` when it was read). */
export type RadioPos = { index: number; time: number; duration: number; at: number };

/** Pages → background. */
export type RadioCommand =
  | { type: "radio:play"; track: Track }
  | { type: "radio:stop" }
  | { type: "radio:volume"; volume: number }
  | { type: "radio:seek"; time: number }
  /** The next or previous surah of the recitation. */
  | { type: "radio:skip"; dir: 1 | -1 }
  /** Minutes, "surah" (its end) or 0 (cancel). */
  | { type: "radio:sleep"; minutes: number | "surah" }
  /** Start or go on with today's wird. */
  | { type: "radio:wird" };

/** Background → offscreen document. */
export type OffscreenCommand =
  /** A live stream; `ramp` ms to rise from silence (the alarm). */
  | { target: "offscreen"; type: "play"; url: string; volume: number; ramp?: number }
  /** Recordings one after the other, from `index` at `time` seconds; stops after `stopAfter`. */
  | { target: "offscreen"; type: "list"; urls: string[]; index: number; time: number; volume: number; ramp?: number; stopAfter?: number }
  | { target: "offscreen"; type: "stop"; fade?: number }
  | { target: "offscreen"; type: "volume"; volume: number }
  | { target: "offscreen"; type: "seek"; time: number }
  | { target: "offscreen"; type: "stop-after"; index: number }
  /** The adhan: whole or its first part (`short`), over the radio (turned down meanwhile). */
  | { target: "offscreen"; type: "adhan"; url: string; volume: number; short: boolean }
  | { target: "offscreen"; type: "adhan-stop" }
  /** A short zikr recording (the reminder). */
  | { target: "offscreen"; type: "zikr"; url: string; volume: number };

/** Offscreen document → background. */
export type OffscreenReport =
  | { type: "radio:status"; status: RadioStatus }
  | { type: "radio:pos"; index: number; time: number; duration: number }
  /** The list ran out, or reached `stopAfter`: `index` is the last one played. */
  | { type: "radio:ended"; index: number };

export const STATIONS: ExtStation[] = __STATIONS__;
export const stationById = (id: number | null) => STATIONS.find((s) => s.id === id) ?? null;

const KEY = "radio";
export const POS_KEY = "radio.pos";
export const DEFAULT_RADIO: RadioState = { track: null, status: "stopped", volume: 0.8, sleep: null };

function normalize(raw: unknown): RadioState {
  const r = (raw ?? {}) as Partial<RadioState> & { id?: number | null };
  // 1.4 and before kept a station id.
  const track = r.track ?? (typeof r.id === "number" ? { kind: "live" as const, id: r.id } : null);
  return { ...DEFAULT_RADIO, ...r, track };
}

export async function radioState(): Promise<RadioState> {
  return normalize((await chrome.storage.local.get(KEY))[KEY]);
}

let writing: Promise<unknown> = Promise.resolve();

/** One change at a time (the background gets several reports at once); a function patches what's there by then. */
export function setRadioState(patch: Partial<RadioState> | ((s: RadioState) => Partial<RadioState>)): Promise<RadioState> {
  const run = writing.then(async () => {
    const now = await radioState();
    const next = { ...now, ...(typeof patch === "function" ? patch(now) : patch) };
    await chrome.storage.local.set({ [KEY]: next });
    return next;
  });
  writing = run.catch(() => undefined);
  return run;
}

export function onRadioChange(cb: (s: RadioState) => void) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[KEY]) cb(normalize(changes[KEY].newValue));
  });
}

export const sendRadio = (cmd: RadioCommand) => chrome.runtime.sendMessage(cmd).catch(() => undefined);

export const sameTrack = (a: Track | null, b: Track | null) =>
  !!a && !!b && a.kind === b.kind && (a.kind === "live" ? a.id === (b as typeof a).id : a.kind === "surah" ? a.moshaf === (b as typeof a).moshaf && a.surah === (b as typeof a).surah : true);

export const surahName = (n: number) => `سورة ${SURAHS[n - 1]?.[0] ?? ""}`;

/** What's playing in two lines: [title, by whom]. */
export function trackLabel(t: Track): [string, string] {
  if (t.kind === "live") return [stationById(t.id)?.name ?? "إذاعة", "بث مباشر"];
  if (t.kind === "surah") return [surahName(t.surah), moshafById(t.moshaf) ? moshafLabel(t.moshaf) : ""];
  const { s, a } = ayahAt(t.ayah);
  return [`الورد — الجزء ${juzOf(t.ayah).toLocaleString("ar-EG")}`, `${surahName(s)}، الآية ${a.toLocaleString("ar-EG")} — ${ayahReciter(t.reciter).name}`];
}

/** The surah a station is on now, from the site (it reads the stream's title; cached there for 30 s). */
export async function nowPlaying(id: number): Promise<string | null> {
  try {
    const res = await fetch(`${__SITE__}/api/radio/${id}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { title: string | null; surah: string | null };
    return data.surah ? `سورة ${data.surah}` : data.title;
  } catch {
    return null;
  }
}
