/**
 * The player's audio: the live station (reconnecting a dropped stream) or a
 * list of recordings one after another (a recitation, the wird's ayat), the
 * adhan (the player turned down while it sounds) and the zikr sound; volume can
 * rise slowly (the alarm) or fade out (the sleep timer). Runs in the offscreen
 * document (Chrome, Edge) or in Firefox's background page, which can play audio.
 */
import type { OffscreenCommand, OffscreenReport, RadioStatus } from "./radio";

const audio = new Audio();
audio.preload = "none";
/** The next recording, loaded ahead so the list runs on without a gap. */
const ahead = new Audio();
ahead.preload = "auto";

let mode: "live" | "list" | null = null;
let url: string | null = null;
let list: string[] = [];
let index = 0;
let stopAfter = -1;
let retries = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

// The volume is the chosen one × the adhan's ducking × the rise or fade.
let base = 1;
let ramp = 1;
let rampTimer: ReturnType<typeof setInterval> | undefined;
const ducked = () => !!adhan.src;
const applyVolume = () => (audio.volume = Math.max(0, Math.min(1, base * (ducked() ? 0.12 : 1) * ramp)));

/** Volume from silence to full over `ms` (to = 1), or from here to silence and then stop (to = 0). */
function slide(to: 0 | 1, ms: number, then?: () => void) {
  clearInterval(rampTimer);
  const from = ramp;
  const started = Date.now();
  rampTimer = setInterval(() => {
    const k = Math.min(1, (Date.now() - started) / ms);
    ramp = from + (to - from) * k;
    applyVolume();
    if (k >= 1) {
      clearInterval(rampTimer);
      then?.();
    }
  }, 100);
}

let reporter: (r: OffscreenReport) => void = () => undefined;
/** Where the reports go: the background by message (offscreen document), or a direct call (Firefox's background page). */
export const onReport = (fn: (r: OffscreenReport) => void) => (reporter = fn);
const send = async (r: OffscreenReport) => reporter(r);
const report = (status: RadioStatus) => send({ type: "radio:status", status });

// ---------- the adhan ----------

/** «مختصر»: the opening takbirs, then a fade. */
const SHORT_MS = 22_000;
const FADE_MS = 3_000;
const adhan = new Audio();
let adhanTimer: ReturnType<typeof setInterval> | undefined;

function playAdhan(src: string, volume: number, short: boolean) {
  stopAdhan();
  adhan.src = src;
  adhan.volume = volume;
  applyVolume();
  void adhan.play().catch(() => stopAdhan());
  if (short) {
    const started = Date.now();
    adhanTimer = setInterval(() => {
      const left = SHORT_MS - (Date.now() - started);
      if (left <= 0) return stopAdhan();
      if (left < FADE_MS) adhan.volume = volume * (left / FADE_MS);
    }, 100);
  }
}

function stopAdhan() {
  clearInterval(adhanTimer);
  adhan.pause();
  adhan.removeAttribute("src");
  applyVolume();
}

adhan.addEventListener("ended", stopAdhan);

const zikr = new Audio();

// ---------- the player ----------

function startLive() {
  if (!url) return;
  clearTimeout(retryTimer);
  // A fresh URL each time: a live stream resumed from the old buffer would play stale audio.
  audio.src = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
  audio.play().catch(() => undefined);
}

function startItem(time = 0) {
  clearTimeout(retryTimer);
  audio.src = list[index];
  if (time > 0) audio.currentTime = time;
  audio.play().catch(() => undefined);
  if (list[index + 1]) ahead.src = list[index + 1];
  lastPos = 0;
}

function stop() {
  mode = null;
  url = null;
  list = [];
  clearTimeout(retryTimer);
  clearInterval(rampTimer);
  ramp = 1;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  ahead.removeAttribute("src");
}

let lastPos = 0;
function reportPos(force = false) {
  if (mode !== "list" || (!force && Date.now() - lastPos < 5000)) return;
  lastPos = Date.now();
  void send({ type: "radio:pos", index, time: audio.currentTime, duration: Number.isFinite(audio.duration) ? audio.duration : 0 });
}

audio.addEventListener("playing", () => {
  retries = 0;
  void report("playing");
  reportPos(true);
});
audio.addEventListener("waiting", () => void report("loading"));
audio.addEventListener("timeupdate", () => reportPos());
audio.addEventListener("ended", () => {
  if (mode !== "list") return;
  if (index === stopAfter || index + 1 >= list.length) {
    const last = index;
    stop();
    void send({ type: "radio:ended", index: last });
    return;
  }
  index++;
  startItem();
});
for (const ev of ["error", "ended", "stalled"] as const) {
  audio.addEventListener(ev, () => {
    if (mode === "live") {
      if (ev === "stalled" && !audio.paused && audio.readyState >= 3) return;
      if (retries >= 5) return void report("error");
      retries++;
      void report("loading");
      retryTimer = setTimeout(startLive, Math.min(15_000, 1000 * 2 ** retries));
    } else if (mode === "list" && ev === "error") {
      // A recording that won't load: a few tries from where it was.
      if (retries >= 3) return void report("error");
      retries++;
      void report("loading");
      const at = audio.currentTime;
      retryTimer = setTimeout(() => startItem(at), 1500 * retries);
    }
  });
}

function begin(volume: number, rampMs?: number) {
  base = volume;
  retries = 0;
  clearInterval(rampTimer);
  ramp = rampMs ? 0.03 : 1;
  applyVolume();
  if (rampMs) slide(1, rampMs);
}

/** One command from the background. */
export function handle(msg: OffscreenCommand) {
  switch (msg.type) {
    case "play":
      stop();
      mode = "live";
      url = msg.url;
      begin(msg.volume, msg.ramp);
      startLive();
      break;
    case "list":
      stop();
      mode = "list";
      list = msg.urls;
      index = Math.min(msg.index, list.length - 1);
      stopAfter = msg.stopAfter ?? -1;
      begin(msg.volume, msg.ramp);
      startItem(msg.time);
      break;
    case "stop":
      if (msg.fade && mode) slide(0, msg.fade, stop);
      else stop();
      break;
    case "volume":
      base = msg.volume;
      applyVolume();
      break;
    case "seek":
      if (mode === "list") {
        audio.currentTime = msg.time;
        reportPos(true);
      }
      break;
    case "stop-after":
      stopAfter = msg.index;
      break;
    case "adhan":
      playAdhan(msg.url, msg.volume, msg.short);
      break;
    case "adhan-stop":
      stopAdhan();
      break;
    case "zikr":
      zikr.src = msg.url;
      zikr.volume = msg.volume;
      void zikr.play().catch(() => undefined);
      break;
  }
}
