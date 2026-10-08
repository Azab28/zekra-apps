/**
 * Adhan and azkar notifications, scheduled on the device (no server): the
 * next days' prayers from prayer-calc as one-off notifications, with the
 * chosen muezzin's adhan (src/core/adhan-voices.ts) or the phone's sound, and
 * morning/evening azkar 20 minutes after fajr/asr (as the site's Web Push and
 * the bot), scheduled again whenever the app opens or the place/settings
 * change. iOS keeps at most 64 pending, so the days ahead depend on how many
 * a day are chosen. Tapping an azkar notification opens its reader. Also the
 * other reminders (core/reminders.ts): the occasions, the Quran alarm (a tap
 * plays its recitation), a zikr every so often and Al-Kahf on Friday (these
 * two repeat by themselves).
 *
 * expo-notifications is loaded only when used: Expo Go on Android (SDK 53+)
 * throws as soon as it is imported, which took the whole app down. There the
 * adhan section says it needs the development build (`notificationsSupported`).
 */
import Constants, { ExecutionEnvironment } from "expo-constants";
import type * as NotificationsModule from "expo-notifications";
import { Platform } from "react-native";
import { prayerTimesFor } from "@lib/schedule/prayer-calc";
import type { SitePlace } from "@lib/site-prefs";
import type { PrayerName } from "@lib/types";
import { calcPlace, dayAt, prayerLabel, untilPhrase } from "./prayer";
import { SYSTEM_SOUND, voiceName } from "./adhan-voices";
import { alarmTimes, occasionReminders, zikrPhrases } from "./reminders";
import { SALAH, type AppSettings } from "./settings";
import { readJson, writeJson } from "./storage";

type Notifications = typeof NotificationsModule;

/**
 * Android channels keep the settings they were made with, so a change to one
 * needs a new id (the old ones are deleted). The first ones named sound
 * "default", which Android looked up as a sound file.
 */
const ADHAN_CHANNEL = "adhan-v2";
const REMINDER_CHANNEL = "reminders-v2";
const AZKAR_CHANNEL = "azkar-v1";
const OCCASIONS_CHANNEL = "occasions-v1";
const ZIKR_CHANNEL = "zikr-v1";
const ALARM_CHANNEL = "quran-alarm-v1";
const OLD_CHANNELS = ["adhan", "reminders"];
/** A muezzin's adhan is its own channel on Android (a channel's sound is fixed). */
const voiceChannel = (voice: string) => (voice === SYSTEM_SOUND ? ADHAN_CHANNEL : `adhan-${voice}-v1`);
/** Under iOS's 64, leaving room for anything else the app may schedule later. */
const MAX_PENDING = 56;
const MAX_DAYS = 7;

/** Expo Go on Android: no expo-notifications at all. */
const expoGoAndroid = Platform.OS === "android" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let loaded: Notifications | null | undefined;

/** The module, loaded on first use; null where it can't work (Expo Go on Android, or it failed to load). */
function notifications(): Notifications | null {
  if (loaded !== undefined) return loaded;
  loaded = null;
  if (expoGoAndroid) return loaded;
  try {
    const mod = require("expo-notifications") as Notifications;
    mod.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    loaded = mod;
  } catch {
    loaded = null;
  }
  return loaded;
}

/** Whether this build can schedule notifications (false in Expo Go on Android). */
export const notificationsSupported = (): boolean => notifications() !== null;

/** The channels: the system's own sound (no `sound`: a name there means a file in the app), or the chosen adhan (res/raw). */
async function ensureChannels(N: Notifications, voice: string) {
  if (Platform.OS !== "android") return;
  for (const id of OLD_CHANNELS) await N.deleteNotificationChannelAsync(id).catch(() => undefined);
  await N.setNotificationChannelAsync(ADHAN_CHANNEL, {
    name: "الأذان",
    description: "عند دخول وقت كل صلاة",
    importance: N.AndroidImportance.HIGH,
    vibrationPattern: [0, 400, 200, 400],
    lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
  });
  if (voice !== SYSTEM_SOUND) {
    await N.setNotificationChannelAsync(voiceChannel(voice), {
      name: `الأذان بصوت ${voiceName(voice)}`,
      description: "الأذان كاملًا عند دخول وقت كل صلاة",
      importance: N.AndroidImportance.HIGH,
      sound: `${voice}.mp3`,
      vibrationPattern: [0, 400, 200, 400],
      lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
      audioAttributes: { usage: N.AndroidAudioUsage.ALARM, contentType: N.AndroidAudioContentType.SONIFICATION },
    });
  }
  // Other muezzins' channels from an earlier choice.
  for (const c of await N.getNotificationChannelsAsync().catch(() => [])) {
    if (c?.id?.startsWith("adhan-adhan_") && c.id !== voiceChannel(voice)) await N.deleteNotificationChannelAsync(c.id).catch(() => undefined);
  }
  await N.setNotificationChannelAsync(REMINDER_CHANNEL, {
    name: "قبل الأذان",
    description: "تذكير قبل الصلاة بدقائق",
    importance: N.AndroidImportance.DEFAULT,
  });
  await N.setNotificationChannelAsync(AZKAR_CHANNEL, {
    name: "الأذكار",
    description: "أذكار الصباح بعد الفجر، وأذكار المساء بعد العصر",
    importance: N.AndroidImportance.DEFAULT,
  });
  await N.setNotificationChannelAsync(OCCASIONS_CHANNEL, {
    name: "المناسبات والجمعة",
    description: "أيام الصيام، ورمضان، وذو الحجة، والعيد، وسورة الكهف يوم الجمعة",
    importance: N.AndroidImportance.DEFAULT,
  });
  await N.setNotificationChannelAsync(ZIKR_CHANNEL, {
    name: "تذكير بالذكر",
    description: "ذكر من حصن المسلم كل فترة",
    importance: N.AndroidImportance.LOW,
  });
  await N.setNotificationChannelAsync(ALARM_CHANNEL, {
    name: "منبّه القرآن",
    description: "قبل الفجر أو في الوقت الذي تختاره",
    importance: N.AndroidImportance.HIGH,
    lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
    audioAttributes: { usage: N.AndroidAudioUsage.ALARM, contentType: N.AndroidAudioContentType.SONIFICATION },
  });
}

/** Whether notifications may be shown, asking once if the system hasn't been asked yet. */
export async function askPermission(): Promise<boolean> {
  const N = notifications();
  if (!N) return false;
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await N.requestPermissionsAsync();
  return asked.granted;
}

export async function hasPermission(): Promise<boolean> {
  const N = notifications();
  return N ? (await N.getPermissionsAsync()).granted : false;
}

type Planned = { at: Date; title: string; body: string; channel: string; adhan?: boolean; url?: string; alarm?: boolean };

/** Whether any notification is on (each part has its own switch). */
export const anyReminder = (s: AppSettings) => s.adhan.enabled || s.reminders.zikr.on || s.reminders.kahf || s.reminders.alarm.on || s.reminders.occasions.on;

/** What to schedule from `now` on, soonest first, within the limits. */
export function plan(place: SitePlace | null, settings: AppSettings, now = Date.now(), hijriOffset = 0): Planned[] {
  const { adhan, reminders } = settings;
  const out: Planned[] = [];
  const p = place ? calcPlace(place, settings.madhab) : null;
  const city = place?.city ?? "";
  // The Quran alarm (a set time works without a place), and the occasions.
  for (const at of alarmTimes(reminders.alarm, p, now)) out.push({ at, title: "منبّه القرآن", body: "اضغط للاستماع", channel: ALARM_CHANNEL, alarm: true });
  if (p && reminders.occasions.on) {
    for (const r of occasionReminders(reminders.occasions.kinds, p, hijriOffset, now, MAX_DAYS + 1)) out.push({ ...r, channel: OCCASIONS_CHANNEL });
  }
  const names: PrayerName[] = [...(adhan.sunrise ? (["sunrise"] as const) : []), ...SALAH.filter((k) => adhan.prayers[k])];
  const azkar = (adhan.morning ? 1 : 0) + (adhan.evening ? 1 : 0);
  const perDay = Math.max(1, names.length + (adhan.before ? names.filter((k) => k !== "sunrise").length : 0) + azkar);
  const days = !p || !adhan.enabled ? -1 : Math.max(1, Math.min(MAX_DAYS, Math.floor(MAX_PENDING / perDay)));
  for (let d = 0; p && d <= days; d++) {
    const day = dayAt(p.timezone, now, d);
    const times = prayerTimesFor(day, p);
    for (const k of names) {
      const at = times[k];
      const label = prayerLabel(k, day);
      if (k === "sunrise") {
        out.push({ at, title: "الشروق", body: `${city}: انتهى وقت الفجر`, channel: REMINDER_CHANNEL });
        continue;
      }
      out.push({ at, title: `حان الآن وقت صلاة ${label}`, body: city, channel: voiceChannel(adhan.voice), adhan: true });
      if (adhan.before) {
        const before = new Date(at.getTime() - adhan.before * 60_000);
        out.push({ at: before, title: `${label} بعد ${untilPhrase(adhan.before)}`, body: city, channel: REMINDER_CHANNEL });
      }
    }
    const after = (at: Date) => new Date(at.getTime() + 20 * 60_000);
    if (adhan.morning) out.push({ at: after(times.fajr), title: "أذكار الصباح", body: "اضغط لقراءتها مع العدّاد", channel: AZKAR_CHANNEL, url: "/azkar/morning" });
    if (adhan.evening) out.push({ at: after(times.asr), title: "أذكار المساء", body: "اضغط لقراءتها مع العدّاد", channel: AZKAR_CHANNEL, url: "/azkar/evening" });
  }
  return out
    .filter((x) => x.at.getTime() > now + 5_000)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_PENDING - REPEATING);
}

/** The zikr and Friday notices repeat by themselves: one pending notification each. */
const REPEATING = 2;

let queue: Promise<unknown> = Promise.resolve();

/** Replaces every scheduled notification with the current plan (one run at a time). */
export function reschedule(place: SitePlace | null, settings: AppSettings, hijriOffset = 0): Promise<number> {
  const run = async () => {
    const N = notifications();
    if (!N) return 0;
    await N.cancelAllScheduledNotificationsAsync();
    if (!anyReminder(settings) || !(await hasPermission())) return 0;
    await ensureChannels(N, settings.adhan.voice);
    const list = plan(place, settings, Date.now(), hijriOffset);
    for (const x of list) {
      await N.scheduleNotificationAsync({
        content: {
          title: x.title,
          body: x.body,
          sound: x.adhan ? iosSound(settings.adhan.voice) : true,
          data: x.alarm ? { alarm: true } : x.url ? { url: x.url } : undefined,
        },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: x.at, channelId: x.channel },
      });
    }
    const { zikr, kahf } = settings.reminders;
    if (zikr.on) {
      // A different phrase each time the reminders are set again (every time the app opens).
      const all = zikrPhrases();
      const i = ((await readJson<number>("zikr:next")) ?? 0) % Math.max(1, all.length);
      await writeJson("zikr:next", i + 1);
      if (all.length) {
        await N.scheduleNotificationAsync({
          content: { title: "ذِكر", body: all[i], sound: false },
          trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: zikr.every * 60, repeats: true, channelId: ZIKR_CHANNEL },
        });
      }
    }
    if (kahf) {
      // Friday 10:00 (weekday 6: Sunday is 1).
      await N.scheduleNotificationAsync({
        content: { title: "يوم الجمعة: سورة الكهف", body: "اضغط لقراءتها أو الاستماع إليها", sound: true, data: { url: "/surah/18" } },
        trigger: { type: N.SchedulableTriggerInputTypes.WEEKLY, weekday: 6, hour: 10, minute: 0, channelId: OCCASIONS_CHANNEL },
      });
    }
    return list.length;
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

/** On iOS the content names the sound (the first 28 s of the adhan, assets/adhan-ios); Android's comes from the channel. */
const iosSound = (voice: string): string | boolean => (Platform.OS === "ios" && voice !== SYSTEM_SOUND ? `${voice}.caf` : true);

/** A test notification in a few seconds, to hear how it sounds. */
export async function sendTest(city: string, voice: string): Promise<void> {
  const N = notifications();
  if (!N) return;
  await ensureChannels(N, voice);
  await N.scheduleNotificationAsync({
    content: { title: "تجربة تنبيه الأذان", body: city, sound: iosSound(voice) },
    trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: voiceChannel(voice) },
  });
}

/** Opens what a tapped notification points to (a page, or the Quran alarm's recitation); returns the unsubscribe. */
export function onNotificationOpen(open: (url: string) => void, alarm: () => void): () => void {
  const N = notifications();
  if (!N) return () => undefined;
  const handle = (data: unknown) => {
    const d = data as { url?: unknown; alarm?: unknown } | undefined;
    if (d?.alarm === true) return alarm();
    if (typeof d?.url === "string" && d.url.startsWith("/")) open(d.url);
  };
  // Opened from a notification while the app wasn't running.
  void N.getLastNotificationResponseAsync()
    .then((r) => {
      if (!r) return;
      handle(r.notification.request.content.data);
      return N.clearLastNotificationResponseAsync();
    })
    .catch(() => undefined);
  const sub = N.addNotificationResponseReceivedListener((r) => handle(r.notification.request.content.data));
  return () => sub.remove();
}
