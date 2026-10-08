/**
 * The extension's service worker: prayer and azkar notifications (chrome.alarms),
 * the time to the next prayer on the toolbar icon, the live radio and the
 * adhan (played in an offscreen document) with the recitations, the wird, the
 * sleep timer and the Quran alarm, to-do reminders, and the copy of the
 * user's data in their Chrome account.
 */
import { loadLists, saveLists, TODO_KEY, dueReminders } from "./lib/data";
import { isSynced, pullIfNewer, push } from "./lib/sync";
import { loadSettings, type Settings } from "./lib/settings";
import {
  azkarWindow,
  countdown,
  formatTime,
  minutesLabel,
  n,
  nextPrayer,
  prayerLabel,
  upcomingReminders,
  type Reminder,
} from "./lib/times";
import {
  nowPlaying,
  POS_KEY,
  radioState,
  setRadioState,
  stationById,
  trackLabel,
  type OffscreenCommand,
  type OffscreenReport,
  type RadioCommand,
  type RadioPos,
  type Track,
} from "./lib/radio";
import { moshafById, moshafLabel, surahUrl } from "./lib/reciters";
import { audioOpen, ensureAudio, onAudioReport, toAudio } from "./lib/audio-host";
import { ayahAt, AYAH_TOTAL, juzRange } from "./lib/quran";
import {
  BAQARAH_KEY,
  loadRecent,
  loadResume,
  loadWird,
  nextAlarm,
  nextKahf,
  RECENT_KEY,
  RESUME_KEY,
  resumeKey,
  saveWird,
  today,
  wirdItems,
} from "./lib/listen";

const TICK = "tick";
const REMINDER_PREFIX = "r|";
/** A reminder that fires this late (the computer was asleep) is dropped instead of shown. */
const STALE_MS = 10 * 60_000;
const AZKAR_URL = { morning: `${__SITE__}/r/morning`, evening: `${__SITE__}/r/evening` };

// ---------- reminders ----------

async function schedule() {
  const s = await loadSettings();
  const old = await chrome.alarms.getAll();
  await Promise.all(old.filter((a) => a.name.startsWith(REMINDER_PREFIX)).map((a) => chrome.alarms.clear(a.name)));
  // Chrome keeps at most 500 alarms; a day and a bit of reminders is a dozen.
  for (const r of upcomingReminders(s)) {
    await chrome.alarms.create(REMINDER_PREFIX + JSON.stringify(r), { when: r.at });
  }
  await chrome.alarms.create(TICK, { periodInMinutes: 1, delayInMinutes: 1 });
  await catchUpAzkar(s);
  await updateBadge(s);
}

function notify(r: Reminder, s: Settings) {
  const place = s.place!;
  let title: string;
  let message: string;
  if (r.kind === "adhan") {
    title = `حان الآن وقت صلاة ${prayerLabel(r.prayer!)}`;
    message = `${formatTime(new Date(r.at), place.timezone, s.clock24)} — ${place.city}`;
  } else if (r.kind === "before") {
    title = `بقي ${minutesLabel(s.notify.before)} على أذان ${prayerLabel(r.prayer!)}`;
    message = `الأذان ${formatTime(new Date(r.at + s.notify.before * 60_000), place.timezone, s.clock24)} — ${place.city}`;
  } else {
    title = r.kind === "morning" ? "أذكار الصباح" : "أذكار المساء";
    message = "اضغط لتقرأها مع العدّاد.";
  }
  const sound = r.kind === "adhan" && s.adhan.mode !== "off";
  showNote(`${r.kind}|${r.at}`, {
    type: "basic",
    iconUrl: "icons/128.png",
    title,
    message,
    priority: r.kind === "adhan" ? 2 : 1,
    silent: sound,
    ...(sound ? { buttons: [{ title: "إيقاف الأذان" }] } : {}),
  });
  if (sound) void playAdhan(s);
}

async function playAdhan(s: Settings) {
  await ensureAudio();
  await toAudio({ target: "offscreen", type: "adhan", url: chrome.runtime.getURL(`adhan/${s.adhan.voice}.mp3`), volume: s.adhan.volume, short: s.adhan.mode === "short" });
}

async function stopAdhan() {
  if (await audioOpen()) await toAudio({ target: "offscreen", type: "adhan-stop" }).catch(() => undefined);
}

/** Once a day each: a browser opened after the azkar reminder's time still gets it (until dhuhr / isha). */
async function catchUpAzkar(s: Settings) {
  if (!s.place || !s.notify.azkar || s.notify.paused) return;
  const w = azkarWindow(s.place);
  if (!w) return;
  const key = `azkar.${w.kind}`;
  const got = await chrome.storage.local.get(key);
  if (got[key] === w.day) return;
  await chrome.storage.local.set({ [key]: w.day });
  notify({ at: Date.now(), kind: w.kind }, s);
}

async function fire(r: Reminder) {
  const s = await loadSettings();
  if (!s.place) return;
  if (Date.now() - r.at <= STALE_MS) {
    if (r.kind === "morning" || r.kind === "evening") {
      const w = azkarWindow(s.place, r.at + 1000);
      if (w) await chrome.storage.local.set({ [`azkar.${w.kind}`]: w.day });
    }
    notify(r, s);
  }
  await schedule();
}

chrome.notifications.onButtonClicked.addListener((id) => {
  if (id.startsWith("todo|")) void markDone(id);
  else if (id.startsWith("kahf|")) void playKahf();
  else if (id.startsWith("qalarm|")) void stopPlayer();
  else void stopAdhan();
  chrome.notifications.clear(id);
});
// Only when the user dismisses it: Windows closes notifications by itself after a few seconds.
chrome.notifications.onClosed.addListener((id, byUser) => byUser && id.startsWith("adhan|") && void stopAdhan());

chrome.notifications.onClicked.addListener((id) => {
  const kind = id.split("|")[0];
  if (kind === "adhan") void stopAdhan();
  if (kind === "morning" || kind === "evening") chrome.tabs.create({ url: AZKAR_URL[kind] });
  if (kind === "todo") chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html#todo") });
  // Firefox shows no notification buttons: a click does what the button would.
  if (kind === "kahf") void playKahf();
  if (kind === "qalarm") void stopPlayer();
  chrome.notifications.clear(id);
});

/** A notification; Firefox takes only the basic fields (no buttons, priority, silence or staying on screen). */
function showNote(id: string, o: chrome.notifications.NotificationCreateOptions & { type: "basic"; iconUrl: string; title: string; message: string }) {
  chrome.notifications.create(id, __BROWSER__ === "firefox" ? { type: o.type, iconUrl: o.iconUrl, title: o.title, message: o.message } : o);
}

// ---------- toolbar badge ----------

async function updateBadge(s?: Settings) {
  s ??= await loadSettings();
  if (!s.place || !s.badge) {
    await chrome.action.setBadgeText({ text: "" });
    await chrome.action.setTitle({ title: "ذِكرى" });
    return;
  }
  const next = nextPrayer(s.place);
  const left = next.at.getTime() - Date.now();
  const mins = Math.ceil(left / 60_000);
  // The badge fits about four characters: «٤٥» minutes, else «٢:٠٥».
  const text = mins < 60 ? n(mins) : countdown(left);
  await chrome.action.setBadgeBackgroundColor({ color: mins <= 15 ? "#b45309" : "#01684c" });
  await chrome.action.setBadgeTextColor?.({ color: "#ffffff" });
  await chrome.action.setBadgeText({ text });
  await chrome.action.setTitle({
    title: `${prayerLabel(next.prayer)} ${formatTime(next.at, s.place.timezone, s.clock24)} — بعد ${countdown(left)}`,
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TICK) void updateBadge();
  else if (alarm.name.startsWith(REMINDER_PREFIX)) void fire(JSON.parse(alarm.name.slice(REMINDER_PREFIX.length)) as Reminder);
  else if (alarm.name.startsWith(TODO_PREFIX)) void todoAlarm(alarm.name);
  else if (alarm.name === SYNC_ALARM) void syncNow();
  else if (alarm.name === ZIKR_ALARM) void zikrNow();
  else if (alarm.name === SLEEP_ALARM) void stopPlayer(FADE_MS);
  else if (alarm.name === SLEEP_POLL) void pollSleep();
  else if (alarm.name === QURAN_ALARM) void ringAlarm(alarm);
  else if (alarm.name === KAHF_ALARM) void kahfNotice(alarm);
  else if (alarm.name === PING_ALARM) void ping();
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") void chrome.storage.local.set({ [PING_NEW]: true });
  void setupStats();
  void schedule();
  void scheduleZikr();
  void scheduleListen();
  void scheduleTodos();
});
chrome.runtime.onStartup.addListener(() => {
  // The browser was closed: nothing is playing anymore.
  void setRadioState({ status: "stopped", sleep: null });
  void clearSleep();
  void schedule();
  void scheduleZikr();
  void scheduleListen();
  // A newer copy made on another computer is merged in when the browser starts.
  void loadSettings().then((s) => s.sync && pullIfNewer().catch(() => false));
  void setupStats();
  void scheduleTodos();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.settings) {
    void setupStats();
    void schedule();
    void scheduleZikr();
    void scheduleListen();
  }
  if (changes[TODO_KEY]) void scheduleTodos();
  if (Object.keys(changes).some(isSynced)) void queueSync();
});

// ---------- the zikr reminder ----------

const ZIKR_ALARM = "zikr";

/** One repeating alarm at the chosen spacing (left alone when unchanged, so its rhythm holds). */
async function scheduleZikr() {
  const s = await loadSettings();
  const on = s.zikr.on && __ZIKR__.some((z) => !s.zikr.off.includes(z.id));
  const now = await chrome.alarms.get(ZIKR_ALARM);
  if (!on) return void (now && (await chrome.alarms.clear(ZIKR_ALARM)));
  if (now?.periodInMinutes === s.zikr.every) return;
  await chrome.alarms.create(ZIKR_ALARM, { delayInMinutes: s.zikr.every, periodInMinutes: s.zikr.every });
}

/** The next chosen zikr in turn: a notification, and its recording when chosen. */
async function zikrNow() {
  const s = await loadSettings();
  if (!s.zikr.on || s.notify.paused) return;
  const list = __ZIKR__.filter((z) => !s.zikr.off.includes(z.id));
  if (!list.length) return;
  const i = Number((await chrome.storage.local.get("zikr.next"))["zikr.next"]) || 0;
  const z = list[i % list.length];
  await chrome.storage.local.set({ "zikr.next": (i + 1) % list.length });
  showNote(`zikr|${Date.now()}`, { type: "basic", iconUrl: "icons/128.png", title: "ذِكر", message: z.text, priority: 0, silent: s.zikr.sound });
  if (s.zikr.sound) {
    await ensureAudio();
    await toAudio({ target: "offscreen", type: "zikr", url: chrome.runtime.getURL(`zikr/${z.id}.mp3`), volume: s.zikr.volume });
  }
}

// ---------- to-do reminders ----------

const TODO_PREFIX = "t|";

async function scheduleTodos() {
  const old = await chrome.alarms.getAll();
  await Promise.all(old.filter((a) => a.name.startsWith(TODO_PREFIX)).map((a) => chrome.alarms.clear(a.name)));
  for (const { list, todo } of dueReminders(await loadLists())) await chrome.alarms.create(`${TODO_PREFIX}${list}|${todo.id}`, { when: todo.due! });
}

async function todoAlarm(name: string) {
  const [, listId, id] = name.split("|");
  const list = (await loadLists()).find((l) => l.id === listId);
  const todo = list?.todos.find((t) => t.id === id);
  if (!todo || todo.done) return;
  showNote(`todo|${listId}|${id}`, {
    type: "basic",
    iconUrl: "icons/128.png",
    title: `تذكير — ${list!.title}`,
    message: todo.text,
    priority: 2,
    requireInteraction: true,
    buttons: [{ title: "تم" }],
  });
}

async function markDone(notificationId: string) {
  const [, listId, id] = notificationId.split("|");
  const lists = await loadLists();
  const todo = lists.find((l) => l.id === listId)?.todos.find((t) => t.id === id);
  if (!todo) return;
  todo.done = true;
  await saveLists(lists);
}

// ---------- the copy in the Chrome account ----------

const SYNC_ALARM = "sync-push";

/** A change is copied half a minute later (sync takes ~2 writes a minute; several edits make one copy). */
async function queueSync() {
  const s = await loadSettings();
  if (s.sync) await chrome.alarms.create(SYNC_ALARM, { delayInMinutes: 0.5 });
}

async function syncNow() {
  const s = await loadSettings();
  if (!s.sync) return;
  try {
    await push();
    await chrome.storage.local.remove("backup.error");
  } catch (err) {
    await chrome.storage.local.set({ "backup.error": (err as Error).message === "too-big" ? "too-big" : "failed" });
  }
}

// ---------- the anonymous daily count and the page after removal ----------

const PING_ALARM = "ping";
const PING_DAY = "ping.day";
const PING_NEW = "ping.new";

/** The page the browser opens when the extension is removed (s=0: don't count it), and the daily check. */
async function setupStats() {
  const s = await loadSettings();
  const version = chrome.runtime.getManifest().version;
  await chrome.runtime.setUninstallURL(`${__SITE__}/bye?v=${version}${s.stats ? "" : "&s=0"}`);
  if (!(await chrome.alarms.get(PING_ALARM))) await chrome.alarms.create(PING_ALARM, { delayInMinutes: 1, periodInMinutes: 180 });
}

/**
 * Once a UTC day: the version, the browser and which features are switched on
 * (no id, no content); the site adds the country from the address and keeps
 * only counts per day (src/lib/ext-stats.ts).
 */
async function ping() {
  const s = await loadSettings();
  const day = new Date().toISOString().slice(0, 10);
  const got = await chrome.storage.local.get([PING_DAY, PING_NEW, TODO_KEY, "notes"]);
  // Not in Firefox: its add-ons declare their data collection, and this one keeps to none of its own.
  if (__BROWSER__ === "firefox" || !s.stats || got[PING_DAY] === day) return;
  const lists = (got[TODO_KEY] as { todos: unknown[] }[] | undefined) ?? [];
  const features = Object.entries({
    place: !!s.place,
    adhan: s.adhan.mode !== "off",
    zikr: s.zikr.on,
    wird: s.listen.wird.on,
    alarm: s.listen.alarm.on,
    todo: lists.some((l) => l.todos.length > 0),
    notes: Array.isArray(got.notes) && got.notes.length > 0,
    sync: s.sync,
    glass: s.theme.startsWith("glass"),
    search: s.search.show,
  })
    .filter(([, on]) => on)
    .map(([k]) => k);
  const params = new URLSearchParams({
    v: chrome.runtime.getManifest().version,
    b: __BROWSER__,
    f: features.join(","),
    ...(got[PING_NEW] ? { i: "1" } : {}),
  });
  try {
    // no-cors: the answer isn't read, so the extension needs no permission for the site.
    await fetch(`${__SITE__}/api/ext/ping?${params}`, { mode: "no-cors", credentials: "omit", cache: "no-store" });
    await chrome.storage.local.set({ [PING_DAY]: day, [PING_NEW]: false });
  } catch {
    // offline: the next check (every 3 hours) tries again
  }
}

// ---------- the player: live radio, recitations, the wird ----------

/** What each item of the playing list is: surah numbers (a recitation) or ayah indexes (the wird). */
const LIST_KEY = "radio.list";
const SLEEP_ALARM = "sleep";
const SLEEP_POLL = "sleep-poll";
const FADE_MS = 8000;

async function loadList(): Promise<number[]> {
  return ((await chrome.storage.local.get(LIST_KEY))[LIST_KEY] as number[] | undefined) ?? [];
}

async function playTrack(track: Track, opts: { ramp?: number } = {}) {
  await clearSleep();
  const state = await setRadioState({ track, status: "loading", sleep: null });
  await chrome.storage.local.remove(POS_KEY);
  await ensureAudio();
  if (track.kind === "live") {
    const station = stationById(track.id);
    if (!station) return void (await setRadioState({ status: "error" }));
    await toAudio({ target: "offscreen", type: "play", url: station.url, volume: state.volume, ramp: opts.ramp });
  } else if (track.kind === "surah") {
    const got = moshafById(track.moshaf);
    if (!got) return void (await setRadioState({ status: "error" }));
    const surahs = got.moshaf.surahs.filter((n) => n >= track.surah);
    const resume = await loadResume();
    await chrome.storage.local.set({ [LIST_KEY]: surahs });
    await toAudio({
      target: "offscreen",
      type: "list",
      urls: surahs.map((n) => surahUrl(got.moshaf, n)),
      index: 0,
      time: resume[resumeKey(track.moshaf, surahs[0])] ?? 0,
      volume: state.volume,
      ramp: opts.ramp,
    });
    if (surahs[0] === 2) await chrome.storage.local.set({ [BAQARAH_KEY]: Date.now() });
  } else {
    const { urls, ayahs } = wirdItems(track.reciter, track.ayah, track.end);
    await chrome.storage.local.set({ [LIST_KEY]: ayahs });
    await toAudio({ target: "offscreen", type: "list", urls, index: 0, time: 0, volume: state.volume, ramp: opts.ramp });
  }
  if (track.kind !== "wird") await addRecent(track);
}

/** The last few things played, one per station or recitation. */
async function addRecent(track: Track) {
  const same = (t: Track) => (t.kind === "live" && track.kind === "live" && t.id === track.id) || (t.kind === "surah" && track.kind === "surah" && t.moshaf === track.moshaf);
  const recent = (await loadRecent()).filter((t) => !same(t));
  await chrome.storage.local.set({ [RECENT_KEY]: [track, ...recent].slice(0, 6) });
}

/** Today's wird: from where it stopped to the end of that juz. */
async function playWird() {
  const s = await loadSettings();
  const w = await loadWird();
  await playTrack({ kind: "wird", reciter: s.listen.wird.reciter, ayah: w.pos, end: juzRange(w.pos).end });
}

async function stopPlayer(fade = 0) {
  await clearSleep();
  await setRadioState({ status: "stopped", sleep: null });
  // The document may be playing the adhan; Chrome closes it by itself once silent.
  if (await audioOpen()) await toAudio({ target: "offscreen", type: "stop", fade });
}

async function onPos(index: number, time: number, duration: number) {
  await chrome.storage.local.set({ [POS_KEY]: { index, time, duration, at: Date.now() } satisfies RadioPos });
  const t = (await radioState()).track;
  if (!t || t.kind === "live") return;
  const item = (await loadList())[index];
  if (item == null) return;
  if (t.kind === "surah") {
    if (item !== t.surah) {
      // Only if that recitation is still the one playing.
      await setRadioState((st) => (st.track?.kind === "surah" && st.track.moshaf === t.moshaf ? { track: { ...st.track, surah: item } } : {}));
      if (item === 2) await chrome.storage.local.set({ [BAQARAH_KEY]: Date.now() });
    }
    // Kept to resume from, unless it's at the very start or end.
    const resume = await loadResume();
    const key = resumeKey(t.moshaf, item);
    if (time > 15 && duration - time > 20) resume[key] = Math.floor(time);
    else delete resume[key];
    const keys = Object.keys(resume);
    for (const k of keys.slice(0, Math.max(0, keys.length - 50))) delete resume[k];
    await chrome.storage.local.set({ [RESUME_KEY]: resume });
  } else if (item !== t.ayah) {
    await setRadioState((st) => (st.track?.kind === "wird" ? { track: { ...st.track, ayah: item } } : {}));
    await saveWird({ ...(await loadWird()), pos: item });
  }
}

async function onEnded(index: number) {
  const t = (await radioState()).track;
  const item = (await loadList())[index];
  if (t?.kind === "surah" && item != null) {
    const resume = await loadResume();
    delete resume[resumeKey(t.moshaf, item)];
    await chrome.storage.local.set({ [RESUME_KEY]: resume });
  }
  if (t?.kind === "wird" && item != null) {
    const w = await loadWird();
    let pos = item + 1;
    let khatmas = w.khatmas;
    if (pos >= AYAH_TOTAL) {
      pos = 0;
      khatmas++;
      showNote(`khatma|${Date.now()}`, {
        type: "basic",
        iconUrl: "icons/128.png",
        title: "أتممت ختمة استماع",
        message: "بلغت آخر المصحف في وردك، والختمة التالية تبدأ من سورة الفاتحة.",
        priority: 1,
      });
    }
    await saveWird({ pos, khatmas, doneDay: item >= t.end ? today() : w.doneDay });
  }
  await clearSleep();
  await setRadioState({ status: "stopped", sleep: null });
}

// ---------- the sleep timer ----------

async function clearSleep() {
  await chrome.alarms.clear(SLEEP_ALARM);
  await chrome.alarms.clear(SLEEP_POLL);
}

/** The basmala item before a surah's first ayah carries that ayah's index too. */
const isBasmala = (ayahs: number[], i: number) => ayahs[i + 1] === ayahs[i];

async function setSleep(minutes: number | "surah") {
  await clearSleep();
  const state = await radioState();
  const t = state.track;
  if (!t || state.status === "stopped" || minutes === 0) return void (await setRadioState({ sleep: null }));
  if (minutes !== "surah") {
    const at = Date.now() + minutes * 60_000;
    await chrome.alarms.create(SLEEP_ALARM, { when: at });
    return void (await setRadioState({ sleep: { at } }));
  }
  if (t.kind === "live") {
    // The station's title changes when the next surah begins: checked every half minute.
    await setRadioState({ sleep: { surahEnd: true, title: await nowPlaying(t.id) } });
    await chrome.alarms.create(SLEEP_POLL, { periodInMinutes: 0.5 });
    return;
  }
  const at = ((await chrome.storage.local.get(POS_KEY))[POS_KEY] as RadioPos | undefined)?.index ?? 0;
  let last = at;
  if (t.kind === "wird") {
    const ayahs = await loadList();
    const surah = ayahAt(ayahs[at] ?? t.ayah).s;
    while (last + 1 < ayahs.length && ayahAt(ayahs[last + 1]).s === surah && !isBasmala(ayahs, last + 1)) last++;
  }
  await toAudio({ target: "offscreen", type: "stop-after", index: last });
  await setRadioState({ sleep: { surahEnd: true } });
}

async function pollSleep() {
  const state = await radioState();
  const t = state.track;
  if (!t || t.kind !== "live" || !state.sleep || !("surahEnd" in state.sleep) || state.status === "stopped") return clearSleep();
  const title = await nowPlaying(t.id);
  if (!title) return;
  if (!state.sleep.title) return void (await setRadioState({ sleep: { surahEnd: true, title } }));
  if (title !== state.sleep.title) await stopPlayer(FADE_MS);
}

// ---------- the Quran alarm and Friday's Al-Kahf ----------

const QURAN_ALARM = "quran-alarm";
const KAHF_ALARM = "kahf";
/** The alarm rises from silence over a minute. */
const ALARM_RAMP_MS = 60_000;

async function scheduleListen() {
  const s = await loadSettings();
  const at = nextAlarm(s);
  const old = await chrome.alarms.get(QURAN_ALARM);
  if (!at) await chrome.alarms.clear(QURAN_ALARM);
  else if (old?.scheduledTime !== at) await chrome.alarms.create(QURAN_ALARM, { when: at });
  if (!s.listen.kahf) await chrome.alarms.clear(KAHF_ALARM);
  else if (!(await chrome.alarms.get(KAHF_ALARM))) await chrome.alarms.create(KAHF_ALARM, { when: nextKahf() });
}

async function ringAlarm(alarm: chrome.alarms.Alarm) {
  const s = await loadSettings();
  const a = s.listen.alarm;
  if (a.on && Date.now() - alarm.scheduledTime <= STALE_MS) {
    const track: Track = a.play === "live" && stationById(a.station) ? { kind: "live", id: a.station } : { kind: "surah", moshaf: s.listen.moshaf, surah: a.surah };
    await playTrack(track, { ramp: ALARM_RAMP_MS });
    showNote(`qalarm|${Date.now()}`, {
      type: "basic",
      iconUrl: "icons/128.png",
      title: "منبّه القرآن",
      message: trackLabel(track).join(" — "),
      priority: 2,
      requireInteraction: true,
      buttons: [{ title: "إيقاف" }],
    });
  }
  // The next one (fajr moves every day).
  await chrome.alarms.clear(QURAN_ALARM);
  await scheduleListen();
}

async function kahfNotice(alarm: chrome.alarms.Alarm) {
  const s = await loadSettings();
  await chrome.alarms.create(KAHF_ALARM, { when: nextKahf(Date.now() + 60_000) });
  // A computer woken later that Friday still gets it (until 4 pm).
  if (!s.listen.kahf || s.notify.paused || Date.now() - alarm.scheduledTime > 6 * 3600_000) return;
  showNote(`kahf|${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/128.png",
    title: "يوم الجمعة",
    message: `سورة الكهف بصوت ${moshafLabel(s.listen.moshaf)}`,
    priority: 1,
    buttons: [{ title: "استمع" }],
  });
}

async function playKahf() {
  const s = await loadSettings();
  await playTrack({ kind: "surah", moshaf: s.listen.moshaf, surah: 18 });
}

async function onRadio(cmd: RadioCommand) {
  switch (cmd.type) {
    case "radio:play":
      return playTrack(cmd.track);
    case "radio:wird":
      return playWird();
    case "radio:stop":
      return stopPlayer();
    case "radio:volume": {
      const volume = Math.max(0, Math.min(1, cmd.volume));
      await setRadioState({ volume });
      if (await audioOpen()) await toAudio({ target: "offscreen", type: "volume", volume });
      return;
    }
    case "radio:seek":
      if (await audioOpen()) await toAudio({ target: "offscreen", type: "seek", time: cmd.time });
      return;
    case "radio:skip": {
      const t = (await radioState()).track;
      if (t?.kind !== "surah") return;
      const surahs = moshafById(t.moshaf)?.moshaf.surahs ?? [];
      const next = surahs[surahs.indexOf(t.surah) + cmd.dir];
      if (next) await playTrack({ ...t, surah: next });
      return;
    }
    case "radio:sleep":
      return setSleep(cmd.minutes);
  }
}

/** What the audio engine reports: by message from the offscreen document, or called directly in Firefox. */
function onAudio(msg: OffscreenReport) {
  if (msg.type === "radio:status") void radioState().then((s) => (s.status === "stopped" ? undefined : setRadioState({ status: msg.status })));
  else if (msg.type === "radio:pos") void onPos(msg.index, msg.time, msg.duration);
  else if (msg.type === "radio:ended") void onEnded(msg.index);
}
onAudioReport(onAudio);

chrome.runtime.onMessage.addListener((msg: RadioCommand | OffscreenReport | OffscreenCommand, sender, reply) => {
  // Only this extension's own pages (no other extension or site can reach it: no externally_connectable).
  if (sender.id !== chrome.runtime.id || !msg || typeof msg !== "object") return;
  if ("target" in msg) return; // meant for the offscreen document
  if (msg.type === "radio:status" || msg.type === "radio:pos" || msg.type === "radio:ended") return void onAudio(msg);
  if (msg.type.startsWith("radio:")) {
    onRadio(msg).then(
      () => reply({ ok: true }),
      () => reply({ ok: false }),
    );
    return true;
  }
});
