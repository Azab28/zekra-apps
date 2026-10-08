/**
 * The website's personal tools (prayer place, tasbeeh counts, khatma) as one
 * small state, changed by actions. Client-safe: the browser applies them to
 * its own copy (kept on the device), and /api/me applies the same actions to
 * the user's user_prefs row when the site is opened from Telegram, so the bot
 * and the site share one khatma, one tasbeeh total and one city. A signed-in
 * account also keeps the site's look and reading settings (`settings`).
 */
import { AYAH_RECITERS } from "./ayah-audio";
import { isAyahLayout, isImageStyle, isSurahFrame } from "./image-styles";
import { isPalette } from "./palettes";
import { adjustKey, normalizeAdjust } from "./schedule/prayer-calc";
import { KHATMA_DAILY_OPTIONS } from "./tasbeeh";
import type { PrayerAdjust, SiteSettings } from "./types";

export const MUSHAF_PAGE_COUNT = 604;

export type SitePlace = {
  city: string;
  timezone: string;
  latitude: number;
  longitude: number;
  calcMethod: string;
  /** Minutes per prayer on top of the calculation. */
  prayerAdjust?: PrayerAdjust | null;
};

export type SitePrefs = {
  place: SitePlace | null;
  tasbeeh: { day: string | null; today: number; total: number };
  /** `page`: the next page to read (null = not started); `day`: local date the wird was last done; `started`: when this khatma began. */
  khatma: { page: number | null; daily: number; done: number; day: string | null; started?: string | null };
  /** Days in a row with a wird (from the account's activity; synced mode only). */
  streak?: { days: number; today: boolean } | null;
  /** The account's look and reading settings (synced mode only; null = none saved yet). */
  settings?: SiteSettings | null;
};

export const EMPTY_PREFS: SitePrefs = {
  place: null,
  tasbeeh: { day: null, today: 0, total: 0 },
  khatma: { page: null, daily: 4, done: 0, day: null },
};

export type SiteAction =
  | { type: "get" }
  | ({ type: "place" } & Omit<SitePlace, "prayerAdjust">)
  | { type: "adjust"; prayerAdjust: PrayerAdjust | null }
  /** `batch`: an id for these taps (the phone app), so a request sent again adds them once. */
  | { type: "tasbeeh"; add: number; day: string; batch?: string }
  | { type: "khatma"; daily?: number; done?: boolean; restart?: boolean; day?: string }
  /** A whole azkar chapter read in the reader (counts toward the wird streak). */
  | { type: "azkar"; day: string }
  | { type: "settings"; settings: SiteSettings }
  /**
   * On signing in: what this device had before, for the account (its city
   * and khatma when the account has none yet; tasbeeh counts are added).
   */
  | { type: "adopt"; local: Pick<SitePrefs, "place" | "tasbeeh" | "khatma"> };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The state after an action, or null when the action is invalid. */
export function applyAction(p: SitePrefs, a: SiteAction): SitePrefs | null {
  switch (a.type) {
    case "get":
      return p;
    case "place": {
      const { city, timezone, latitude, longitude, calcMethod } = a;
      const ok =
        typeof city === "string" && city.length > 0 && city.length <= 80 &&
        typeof timezone === "string" && typeof calcMethod === "string" &&
        Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
        Number.isFinite(longitude) && Math.abs(longitude) <= 180;
      // A new city keeps the minute adjustments (like the bot's city picker).
      return ok ? { ...p, place: { city, timezone, latitude, longitude, calcMethod, prayerAdjust: p.place?.prayerAdjust ?? null } } : null;
    }
    case "adjust":
      return p.place ? { ...p, place: { ...p.place, prayerAdjust: normalizeAdjust(a.prayerAdjust) } } : null;
    case "tasbeeh": {
      const add = Math.floor(Number(a.add));
      if (!(add >= 1 && add <= 1000) || !DAY.test(a.day)) return null;
      const t = p.tasbeeh;
      return { ...p, tasbeeh: { day: a.day, today: (t.day === a.day ? t.today : 0) + add, total: t.total + add } };
    }
    case "khatma": {
      const k = p.khatma;
      const day = typeof a.day === "string" && DAY.test(a.day) ? a.day : null;
      if (a.restart) return { ...p, khatma: { ...k, page: 1, day: null, started: day } };
      if (a.daily !== undefined) {
        if (!KHATMA_DAILY_OPTIONS.includes(a.daily)) return null;
        return { ...p, khatma: { ...k, daily: a.daily, page: k.page ?? 1, started: k.page ? k.started : day } };
      }
      if (a.done && k.page && typeof a.day === "string" && DAY.test(a.day)) {
        // Same as the bot's «أنهيت الورد»: move on, or finish the khatma and start over.
        const next = k.page + k.daily;
        return next > MUSHAF_PAGE_COUNT
          ? { ...p, khatma: { ...k, page: 1, done: k.done + 1, day: a.day, started: a.day } }
          : { ...p, khatma: { ...k, page: next, day: a.day } };
      }
      return null;
    }
    case "azkar":
      return DAY.test(a.day) ? p : null;
    case "settings": {
      const settings = normalizeSettings(a.settings);
      return settings ? { ...p, settings } : null;
    }
    case "adopt":
      return adopt(p, a.local);
  }
}

/** Only known settings with valid values (the rest is dropped); null when it isn't an object. */
export function normalizeSettings(raw: unknown): SiteSettings | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const x = raw as Record<string, unknown>;
  const out: SiteSettings = {};
  if (isPalette(x.palette)) out.palette = x.palette;
  for (const k of ["tajweed", "night", "large", "hadithPlain"] as const) if (typeof x[k] === "boolean") out[k] = x[k];
  if (typeof x.reciter === "string" && AYAH_RECITERS.some((r) => r.id === x.reciter)) out.reciter = x.reciter;
  if (isImageStyle(x.imageStyle)) out.imageStyle = x.imageStyle;
  if (isImageStyle(x.pageStyle)) out.pageStyle = x.pageStyle;
  if (isAyahLayout(x.imageLayout)) out.imageLayout = x.imageLayout;
  if (isSurahFrame(x.imageFrame)) out.imageFrame = x.imageFrame;
  return out;
}

function adopt(p: SitePrefs, local: unknown): SitePrefs | null {
  if (!local || typeof local !== "object") return null;
  const l = local as Partial<SitePrefs>;
  let next = p;
  if (!p.place && l.place && typeof l.place === "object") {
    const placed = applyAction(next, { type: "place", ...l.place });
    if (placed) next = applyAction(placed, { type: "adjust", prayerAdjust: l.place.prayerAdjust ?? null }) ?? placed;
  }
  const k = l.khatma;
  if (!p.khatma.page && k && typeof k === "object") {
    const page = Number(k.page);
    const done = Number(k.done ?? 0);
    const ok = Number.isInteger(page) && page >= 1 && page <= MUSHAF_PAGE_COUNT && KHATMA_DAILY_OPTIONS.includes(Number(k.daily)) && Number.isInteger(done) && done >= 0 && done <= 1000;
    if (ok) {
      const day = (v: unknown) => (typeof v === "string" && DAY.test(v) ? v : null);
      next = { ...next, khatma: { page, daily: Number(k.daily), done: p.khatma.done + done, day: day(k.day), started: day(k.started) } };
    }
  }
  const t = l.tasbeeh;
  const total = Math.floor(Number(t?.total ?? 0));
  if (total >= 1 && total <= 10_000_000) {
    const today = Math.floor(Number(t?.today ?? 0));
    const day = typeof t?.day === "string" && DAY.test(t.day) ? t.day : null;
    const sameDay = day !== null && (next.tasbeeh.day === null || day === next.tasbeeh.day);
    next = {
      ...next,
      tasbeeh: {
        day: next.tasbeeh.day ?? day,
        today: next.tasbeeh.today + (sameDay && today >= 0 && today <= total ? today : 0),
        total: next.tasbeeh.total + total,
      },
    };
  }
  return next;
}

/** The Ramadan timetable image for this place (src/app/api/imsakiya). */
/** Today's prayer times image (/api/prayer-card) for this place, in a look of src/lib/prayer-card-styles.ts. */
export const prayerCardUrl = (p: SitePlace, style?: string) =>
  `/api/prayer-card?${new URLSearchParams({ lat: String(p.latitude), lng: String(p.longitude), tz: p.timezone, method: p.calcMethod, city: p.city, adj: adjustKey(p.prayerAdjust), ...(style ? { style } : {}) })}`;

export const imsakiyaUrl = (p: SitePlace) =>
  `/api/imsakiya?${new URLSearchParams({ lat: String(p.latitude), lng: String(p.longitude), tz: p.timezone, method: p.calcMethod, city: p.city, adj: adjustKey(p.prayerAdjust) })}`;
