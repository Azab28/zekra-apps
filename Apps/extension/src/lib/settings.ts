/**
 * The user's settings, kept in chrome.storage.local (the shortcuts and
 * favourites outgrow sync's 8 KB per item; older sync settings are moved over once).
 */
import { normalizeAdjust } from "../../../../src/lib/schedule/prayer-calc";
import type { PrayerAdjust } from "../../../../src/lib/types";

export type ExtPlace = {
  city: string;
  timezone: string;
  latitude: number;
  longitude: number;
  calcMethod: string;
  prayerAdjust?: PrayerAdjust | null;
  madhab?: "shafi" | "hanafi";
};

/** The five prayers that have an adhan (not sunrise). */
export const ADHAN_PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type AdhanPrayer = (typeof ADHAN_PRAYERS)[number];

/** Plain colours, or frosted glass over a photo. */
export type Theme = "light" | "dark" | "glass-light" | "glass-dark";
export const THEMES: [Theme, string][] = [
  ["glass-dark", "زجاجي داكن"],
  ["glass-light", "زجاجي فاتح"],
  ["dark", "داكن"],
  ["light", "فاتح"],
];
export const isGlass = (t: Theme) => t === "glass-light" || t === "glass-dark";
export const isDarkTheme = (t: Theme) => t === "dark" || t === "glass-dark";

export type BgCategory = "islamic" | "nature" | "favorites" | "custom";
export type DockPosition = "top" | "bottom" | "right" | "left";
export type DockSize = "s" | "m" | "l";

/** A shortcut; `icon: true` means the user gave it a picture (kept in local storage under its id). */
/** `hidden`: only inside «كل الاختصارات», not in the bar. `app`: an installed app (launched, not opened). */
export type DockLink = { id: string; title: string; url: string; icon?: boolean; hidden?: boolean; app?: string; appIcon?: string };
export type DockGroup = { id: string; title: string; links: DockLink[]; hidden?: boolean };
export type DockItem = DockLink | DockGroup;
export const isGroup = (i: DockItem): i is DockGroup => "links" in i;

/** The muezzins of the bundled adhan recordings (Apps/extension/adhan/<id>.mp3). */
export const ADHAN_VOICES: [string, string][] = [
  ["adhan-muhammad-refaat", "محمد رفعت"],
  ["adhan-abdulbasit-abdusamad", "عبد الباسط عبد الصمد"],
  ["adhan-mustafa-ismail", "مصطفى إسماعيل"],
  ["adhan-mahmoud-ali-al-banna", "محمود علي البنا"],
  ["adhan-nasr-eldin-tobar", "نصر الدين طوبار"],
  ["adhan-abul-ainain-shuaisha", "أبو العينين شعيشع"],
  ["adhan-ali-ibn-ahmad-mala", "علي أحمد ملا"],
  ["adhan-abdalmajeed-alsarihi", "عبد المجيد السريحي"],
  ["adhan-nasser-al-qatami", "ناصر القطامي"],
  ["adhan-muhammad-jazy", "محمد جازي عبدالله"],
  ["adhan-mohamed-qassas", "محمد بن مروان قصاص"],
];

export type Settings = {
  place: ExtPlace | null;
  /** Days added to the Umm al-Qura date (local moon sighting). */
  hijriOffset: number;
  clock24: boolean;
  theme: Theme;
  background: {
    category: BgCategory;
    /** The chosen photo (backgrounds.json id); a new one each tab when `auto`. */
    id: string | null;
    auto: boolean;
    /** Blur of the photo in px (0: sharp). */
    blur: number;
    favorites: string[];
  };
  dock: {
    position: DockPosition;
    size: DockSize;
    /** The browser's most visited sites as a group of its own (optional `topSites` permission). */
    topGroup: boolean;
    /** The settings button in the dock; hidden, it sits in «كل الاختصارات». */
    showGear: boolean;
    /** «كل الاختصارات»: groups as folders to open, or every link laid out under its group's name. */
    groupsAs: "folders" | "open";
    /** The browser's installed apps (PWAs) as a group (optional `management` permission). */
    apps: boolean;
    /** Open links in a new tab instead of this one. */
    newTab: boolean;
    items: DockItem[];
  };
  /** Remaining time to the next prayer on the toolbar icon. */
  badge: boolean;
  notify: {
    /** Every notification off (the mute button on the prayer card). */
    paused: boolean;
    /** A notification when each chosen prayer's time comes. */
    atAdhan: boolean;
    /** Minutes before the adhan for an early notice (0: none). */
    before: number;
    prayers: Record<AdhanPrayer, boolean>;
    /** Morning azkar after fajr, evening azkar after asr. */
    azkar: boolean;
  };
  adhan: {
    /** The recording at prayer time: whole, its first part, or none (the notification alone). */
    mode: "full" | "short" | "off";
    voice: string;
    volume: number;
  };
  prayer: {
    /** Names and times show on hovering the icons only. */
    compact: boolean;
  };
  ayah: {
    /** A curated passage each tab, or the mushaf in order from where the last tab stopped. */
    order: "random" | "mushaf";
    volume: number;
    /** Favourite passages: [first, last] ayah indexes. */
    favorites: [number, number][];
  };
  /** everyayah.com folder for the recitation. */
  reciter: string;
  /** التفسير الميسر under the ayah. */
  tafsir: boolean;
  /** Where each ayah action sits: the row under the ayah, the «المزيد» menu, or nowhere. */
  controls: Record<AyahAction, ControlPlace>;
  /** The icons in the top corner. */
  tools: Record<ToolId, boolean>;
  weather: { unit: "c" | "f" };
  /** The search box: Chrome's build uses the browser's own engine (chrome.search); Edge's and Firefox's pick one (ENGINES). */
  search: {
    show: boolean;
    engine: string;
    /** Suggestions as you type (Edge, Firefox; optional permission for Google's suggestion service). */
    suggest: boolean;
    /** Keep the typed words after searching. */
    keep: boolean;
    hideEngines: boolean;
    hideButton: boolean;
    size: "s" | "m" | "l";
  };
  /** A copy of the settings, to-dos and notes in the Chrome account (chrome.storage.sync). */
  sync: boolean;
  /** A zikr every so often (Quran Tab's «التذكيرات»): a notification, with its recording when `sound`. */
  zikr: { on: boolean; every: number; sound: boolean; volume: number; off: string[] };
  listen: Listen;
  /** The anonymous daily count sent to the site (no id: version, browser, features on). */
  stats: boolean;
};

/** The popup's recordings, suggestions, wird and alarm. */
export type Listen = {
  /** mp3quran.net recitation (moshaf id) for the suggested surahs, Friday's Kahf and the alarm. */
  moshaf: number;
  /** Surahs suggested for the time (Al-Kahf on Friday, Al-Mulk at night, Al-Baqarah every few days). */
  suggest: boolean;
  /** A notification on Friday morning to listen to Al-Kahf. */
  kahf: boolean;
  /** A juz a day, ayah by ayah (everyayah.com folder). */
  wird: { on: boolean; reciter: string };
  alarm: {
    on: boolean;
    /** Minutes before fajr, or a set time of day (the computer's clock). */
    mode: "fajr" | "time";
    before: number;
    time: string;
    play: "live" | "surah";
    station: number;
    surah: number;
  };
  /** Favourite live stations and recitation reciters. */
  stations: number[];
  reciters: number[];
};

export const ALARM_BEFORE = [0, 10, 15, 20, 30, 45, 60, 90];

export const ZIKR_EVERY: [number, string][] = [
  [15, "١٥ د"],
  [30, "٣٠ د"],
  [60, "ساعة"],
  [120, "ساعتين"],
];

export type ControlPlace = "bar" | "more" | "off";
export const AYAH_ACTIONS = ["favorite", "repeat", "prev", "next", "volume", "share", "tafsir", "mushaf", "shuffle"] as const;
export type AyahAction = (typeof AYAH_ACTIONS)[number];
export const AYAH_ACTION_LABELS: Record<AyahAction, string> = {
  favorite: "المفضلة",
  repeat: "تكرار مقطع",
  prev: "الآية السابقة",
  next: "الآية التالية",
  volume: "مستوى الصوت",
  share: "نسخ ومشاركة",
  tafsir: "التفسير الميسر",
  mushaf: "افتح في المصحف",
  shuffle: "آية أخرى",
};
const DEFAULT_CONTROLS: Record<AyahAction, ControlPlace> = {
  favorite: "bar",
  repeat: "bar",
  prev: "bar",
  next: "bar",
  volume: "bar",
  share: "more",
  tafsir: "more",
  mushaf: "more",
  shuffle: "more",
};

export const TOOLS = ["weather", "todo", "notes", "bookmarks", "history", "extensions", "apps", "azkar"] as const;
export type ToolId = (typeof TOOLS)[number];

/** Search engines for the Edge and Firefox builds' picker: {q} is the typed words. (Chrome's store allows only the browser's own engine on a new tab.) */
export const ENGINES: { id: string; name: string; url: string }[] = [
  { id: "google", name: "Google", url: "https://www.google.com/search?q={q}" },
  { id: "bing", name: "Bing", url: "https://www.bing.com/search?q={q}" },
  { id: "duckduckgo", name: "DuckDuckGo", url: "https://duckduckgo.com/?q={q}" },
  { id: "youtube", name: "YouTube", url: "https://www.youtube.com/results?search_query={q}" },
  { id: "quran", name: "القرآن الكريم", url: `${__SITE__}/search?q={q}` },
  { id: "wikipedia", name: "ويكيبيديا", url: "https://ar.wikipedia.org/w/index.php?search={q}" },
];
export const SUGGEST_ORIGIN = "https://suggestqueries.google.com/*";

let seq = 0;
export const newId = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;
const link = (title: string, url: string): DockLink => ({ id: newId(), title, url });

/** Ready-made groups the user can add in one tap. */
export const PRESET_GROUPS: { title: string; links: [string, string][] }[] = [
  {
    title: "التواصل الاجتماعي",
    links: [
      ["Facebook", "https://www.facebook.com/"],
      ["X", "https://x.com/"],
      ["Instagram", "https://www.instagram.com/"],
      ["TikTok", "https://www.tiktok.com/"],
      ["WhatsApp", "https://web.whatsapp.com/"],
      ["Telegram", "https://web.telegram.org/"],
      ["LinkedIn", "https://www.linkedin.com/"],
      ["Snapchat", "https://web.snapchat.com/"],
    ],
  },
  {
    title: "خدمات Google",
    links: [
      ["Gmail", "https://mail.google.com/"],
      ["Drive", "https://drive.google.com/"],
      ["Docs", "https://docs.google.com/document/"],
      ["Sheets", "https://docs.google.com/spreadsheets/"],
      ["Slides", "https://docs.google.com/presentation/"],
      ["Calendar", "https://calendar.google.com/"],
      ["Maps", "https://maps.google.com/"],
      ["Photos", "https://photos.google.com/"],
      ["Translate", "https://translate.google.com/"],
    ],
  },
  {
    title: "الذكاء الاصطناعي",
    links: [
      ["ChatGPT", "https://chatgpt.com/"],
      ["Claude", "https://claude.ai/"],
      ["Gemini", "https://gemini.google.com/"],
      ["Copilot", "https://copilot.microsoft.com/"],
      ["Perplexity", "https://www.perplexity.ai/"],
    ],
  },
  {
    title: "خدمات Microsoft",
    links: [
      ["Outlook", "https://outlook.live.com/"],
      ["OneDrive", "https://onedrive.live.com/"],
      ["Word", "https://word.cloud.microsoft/"],
      ["Excel", "https://excel.cloud.microsoft/"],
      ["PowerPoint", "https://powerpoint.cloud.microsoft/"],
      ["Teams", "https://teams.live.com/"],
      ["To Do", "https://to-do.live.com/"],
      ["Bing", "https://www.bing.com/"],
    ],
  },
  {
    title: "ترفيه",
    links: [
      ["YouTube", "https://www.youtube.com/"],
      ["Netflix", "https://www.netflix.com/"],
      ["Shahid", "https://shahid.mbc.net/"],
    ],
  },
];

export const presetGroup = (i: number): DockGroup => ({ id: newId(), title: PRESET_GROUPS[i].title, links: PRESET_GROUPS[i].links.map(([t, u]) => link(t, u)) });

export const DEFAULT_ITEMS = (): DockItem[] => [
  link("ذِكرى", `${__SITE__}/`),
  link("Google", "https://www.google.com/"),
  link("YouTube", "https://www.youtube.com/"),
  link("Gmail", "https://mail.google.com/"),
];

export const DEFAULT_SETTINGS: Settings = {
  place: null,
  hijriOffset: 0,
  clock24: false,
  theme: "glass-dark",
  background: { category: "islamic", id: null, auto: true, blur: 0, favorites: [] },
  dock: { position: "top", size: "m", topGroup: false, showGear: true, groupsAs: "folders", apps: false, newTab: false, items: DEFAULT_ITEMS() },
  badge: true,
  notify: {
    paused: false,
    atAdhan: true,
    before: 0,
    prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
    azkar: true,
  },
  adhan: { mode: "full", voice: ADHAN_VOICES[0][0], volume: 0.8 },
  prayer: { compact: false },
  ayah: { order: "random", volume: 1, favorites: [] },
  reciter: "Alafasy_128kbps",
  tafsir: false,
  controls: DEFAULT_CONTROLS,
  tools: { weather: true, todo: true, notes: true, bookmarks: true, history: true, extensions: true, apps: true, azkar: true },
  weather: { unit: "c" },
  search: { show: true, engine: "google", suggest: false, keep: false, hideEngines: false, hideButton: false, size: "m" },
  sync: false,
  zikr: { on: false, every: 30, sound: true, volume: 0.5, off: [] },
  listen: {
    moshaf: 123,
    suggest: true,
    kahf: true,
    wird: { on: false, reciter: "Alafasy_128kbps" },
    alarm: { on: false, mode: "fajr", before: 30, time: "05:00", play: "surah", station: 0, surah: 67 },
    stations: [],
    reciters: [],
  },
  stats: true,
};

export const BEFORE_CHOICES = [0, 5, 10, 15, 20, 30];

const KEY = "settings";
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const unit = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(1, Number(v))) : d);

/** A URL the dock can open: http(s) only, "https://" added when left out. */
export function cleanUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname.includes(".")) return null;
    return url.href;
  } catch {
    return null;
  }
}

function cleanLink(l: Partial<DockLink>): DockLink | null {
  const url = cleanUrl(String(l.url ?? ""));
  if (!url) return null;
  const title = String(l.title ?? "").trim().slice(0, 40) || new URL(url).hostname.replace(/^www\./, "");
  return { id: typeof l.id === "string" && l.id ? l.id : newId(), title, url, ...(l.icon ? { icon: true } : {}), ...(l.hidden ? { hidden: true } : {}) };
}

function cleanItems(raw: unknown): DockItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: DockItem[] = [];
  for (const i of raw.slice(0, 60)) {
    if (i && typeof i === "object" && Array.isArray((i as DockGroup).links)) {
      const g = i as DockGroup;
      out.push({
        id: typeof g.id === "string" && g.id ? g.id : newId(),
        title: String(g.title ?? "").trim().slice(0, 40) || "مجموعة",
        ...(g.hidden ? { hidden: true } : {}),
        links: g.links.map(cleanLink).filter((x): x is DockLink => !!x).slice(0, 40),
      });
    } else {
      const l = cleanLink(i as Partial<DockLink>);
      if (l) out.push(l);
    }
  }
  return out;
}

/** Stored values over the defaults; anything malformed falls back. */
function normalize(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Settings> & { background?: { fog?: boolean }; dock?: { links?: unknown } };
  const d = DEFAULT_SETTINGS;
  const n = (r.notify ?? {}) as Partial<Settings["notify"]>;
  const bg = (r.background ?? {}) as Partial<Settings["background"]> & { fog?: boolean };
  const dock = (r.dock ?? {}) as Partial<Settings["dock"]> & { links?: unknown; source?: string };
  const search = (r.search ?? {}) as Partial<Settings["search"]>;
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  const adhan = (r.adhan ?? {}) as Partial<Settings["adhan"]>;
  const ayah = (r.ayah ?? {}) as Partial<Settings["ayah"]>;
  const place = r.place && typeof r.place.latitude === "number" && typeof r.place.longitude === "number" ? r.place : null;
  return {
    place: place ? { ...place, prayerAdjust: normalizeAdjust(place.prayerAdjust), madhab: place.madhab === "hanafi" ? "hanafi" : "shafi" } : null,
    hijriOffset: Math.max(-2, Math.min(2, Math.round(Number(r.hijriOffset) || 0))),
    clock24: r.clock24 === true,
    theme: pick(r.theme, THEMES.map((t) => t[0]), d.theme),
    background: {
      category: pick(bg.category, ["islamic", "nature", "favorites", "custom"] as const, d.background.category),
      id: typeof bg.id === "string" ? bg.id : null,
      auto: bg.auto !== false,
      // The old on/off fog was 14 px.
      blur: Math.max(0, Math.min(30, Math.round(Number(bg.blur ?? (bg.fog ? 14 : 0)) || 0))),
      favorites: Array.isArray(bg.favorites) ? bg.favorites.filter((x) => typeof x === "string").slice(0, 100) : [],
    },
    dock: {
      position: pick(dock.position, ["top", "bottom", "right", "left"] as const, d.dock.position),
      size: pick(dock.size, ["s", "m", "l"] as const, "m"),
      // 1.2 had «الأكثر زيارة» instead of the user's links.
      topGroup: bool(dock.topGroup, dock.source === "top"),
      showGear: dock.showGear !== false,
      groupsAs: dock.groupsAs === "open" ? "open" : "folders",
      apps: dock.apps === true,
      newTab: dock.newTab === true,
      items: cleanItems(dock.items) ?? cleanItems(dock.links) ?? DEFAULT_ITEMS(),
    },
    badge: r.badge !== false,
    notify: {
      paused: n.paused === true,
      atAdhan: n.atAdhan !== false,
      before: BEFORE_CHOICES.includes(Number(n.before)) ? Number(n.before) : d.notify.before,
      prayers: Object.fromEntries(ADHAN_PRAYERS.map((p) => [p, n.prayers?.[p] !== false])) as Settings["notify"]["prayers"],
      azkar: n.azkar !== false,
    },
    adhan: {
      mode: pick(adhan.mode, ["full", "short", "off"] as const, d.adhan.mode),
      voice: ADHAN_VOICES.some(([id]) => id === adhan.voice) ? adhan.voice! : d.adhan.voice,
      volume: unit(adhan.volume, d.adhan.volume),
    },
    prayer: { compact: r.prayer?.compact === true },
    ayah: {
      order: ayah.order === "mushaf" ? "mushaf" : "random",
      volume: unit(ayah.volume, 1),
      favorites: Array.isArray(ayah.favorites)
        ? ayah.favorites
            .filter((f): f is [number, number] => Array.isArray(f) && Number.isInteger(f[0]) && Number.isInteger(f[1]) && f[0] >= 0 && f[1] >= f[0] && f[1] < 6236)
            .slice(0, 200)
        : [],
    },
    reciter: typeof r.reciter === "string" && r.reciter ? r.reciter : d.reciter,
    tafsir: r.tafsir === true,
    controls: Object.fromEntries(AYAH_ACTIONS.map((a) => [a, pick(r.controls?.[a], ["bar", "more", "off"] as const, DEFAULT_CONTROLS[a])])) as Settings["controls"],
    tools: Object.fromEntries(TOOLS.map((t) => [t, r.tools?.[t] !== false])) as Settings["tools"],
    weather: { unit: r.weather?.unit === "f" ? "f" : "c" },
    search: {
      show: search.show !== false,
      // Chrome's build keeps no engine list at all (its store allows only the browser's own engine).
      engine: __BROWSER__ !== "chrome" && ENGINES.some((e) => e.id === search.engine) ? search.engine! : d.search.engine,
      suggest: search.suggest === true,
      keep: search.keep === true,
      hideEngines: search.hideEngines === true,
      hideButton: search.hideButton === true,
      size: pick(search.size, ["s", "m", "l"] as const, "m"),
    },
    sync: r.sync === true,
    zikr: {
      on: r.zikr?.on === true,
      every: ZIKR_EVERY.some(([m]) => m === Number(r.zikr?.every)) ? Number(r.zikr!.every) : 30,
      sound: r.zikr?.sound !== false,
      volume: unit(r.zikr?.volume, 0.5),
      off: Array.isArray(r.zikr?.off) ? r.zikr!.off.filter((x) => typeof x === "string") : [],
    },
    listen: normalizeListen(r.listen),
    stats: r.stats !== false,
  };
}

function normalizeListen(raw: unknown): Listen {
  const l = (raw ?? {}) as Partial<Listen>;
  const d = DEFAULT_SETTINGS.listen;
  const a = (l.alarm ?? {}) as Partial<Listen["alarm"]>;
  const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is number => Number.isInteger(x)))].slice(0, 100) : []);
  return {
    moshaf: Number.isInteger(l.moshaf) && l.moshaf! > 0 ? l.moshaf! : d.moshaf,
    suggest: l.suggest !== false,
    kahf: l.kahf !== false,
    wird: { on: l.wird?.on === true, reciter: typeof l.wird?.reciter === "string" && l.wird.reciter ? l.wird.reciter : d.wird.reciter },
    alarm: {
      on: a.on === true,
      mode: a.mode === "time" ? "time" : "fajr",
      before: ALARM_BEFORE.includes(Number(a.before)) ? Number(a.before) : d.alarm.before,
      time: typeof a.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(a.time) ? a.time : d.alarm.time,
      play: a.play === "live" ? "live" : "surah",
      station: Number.isInteger(a.station) ? a.station! : d.alarm.station,
      surah: Number.isInteger(a.surah) && a.surah! >= 1 && a.surah! <= 114 ? a.surah! : d.alarm.surah,
    },
    stations: ids(l.stations),
    reciters: ids(l.reciters),
  };
}

export async function loadSettings(): Promise<Settings> {
  const got = await chrome.storage.local.get(KEY);
  if (got[KEY]) return normalize(got[KEY]);
  // Version 1.x kept them in sync storage.
  const old = await chrome.storage.sync.get(KEY).catch(() => ({}) as Record<string, unknown>);
  const s = normalize(old[KEY]);
  if (old[KEY]) await chrome.storage.local.set({ [KEY]: s });
  return s;
}

export async function saveSettings(next: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: next });
  // The theme is also read synchronously before the first paint (boot.ts).
  try {
    localStorage.setItem("theme", next.theme);
  } catch {}
}

export function onSettingsChange(cb: (s: Settings) => void) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[KEY]) cb(normalize(changes[KEY].newValue));
  });
}
