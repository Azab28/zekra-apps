// Shapes stored as JSON in the database, shared by the dashboard and worker.

import type { PrayerCardStyleId } from "./prayer-card-styles";

export type Platform = "telegram" | "whatsapp";

export type PrayerName = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";
/** Minutes added to (or taken from) each calculated time, to match a local mosque or calendar. */
export type PrayerAdjust = Partial<Record<PrayerName, number>>;

/** The website's look and reading settings kept with an account (src/lib/site-prefs.ts checks them). */
export type SiteSettings = {
  palette?: string;
  tajweed?: boolean;
  /** Old: the warm night page, now pageStyle "night". */
  night?: boolean;
  /** The mushaf page's look (an image style id). */
  pageStyle?: string;
  large?: boolean;
  /** Ayah-by-ayah reciter id (src/lib/ayah-audio.ts). */
  reciter?: string;
  /** The look of ayah and page images (src/lib/image-styles.ts). */
  imageStyle?: string;
  /** Hadith text without its diacritics. */
  hadithPlain?: boolean;
  /** Ayah images from the start of the line ("flow") or as printed. */
  imageLayout?: string;
  /** Ayah images: the surah name's frame (src/lib/image-styles.ts SURAH_FRAMES). */
  imageFrame?: string;
};

/** Weekdays use Luxon numbering: 1 = Monday … 7 = Sunday. Empty/undefined = every day. */
export type Timing =
  | { kind: "times"; times: string[]; days?: number[] }
  | { kind: "interval"; everyMinutes: number; from?: string; to?: string; days?: number[] }
  | { kind: "prayer"; prayer: PrayerName; offsetMinutes: number; days?: number[] }
  /** Only on the days (and at the times) of the chosen occasions; see src/lib/schedule/occasion-days.ts. */
  | { kind: "occasions"; include: OccasionKind[] }
  /** One time only; `at` is local time in the channel's timezone ("2026-10-01T20:00"). */
  | { kind: "once"; at: string }
  /** Fridays: the Kahf reminder at `kahf`, a salawat post at each of `salawat` ("HH:mm"). */
  | { kind: "friday"; kahf: string; salawat: string[] };

export type OccasionKind =
  | "fasting"
  | "fasting_weekly"
  | "iftar"
  | "suhoor"
  | "dhul_hijjah"
  | "hijri_month"
  | "eid"
  /** Four posts through the day of Arafah (9 Dhul Hijjah). */
  | "arafah"
  /** The odd nights of Ramadan's last ten (21st, 23rd…), after isha. */
  | "qadr_nights"
  /** Every night, at the start of its last third (between maghrib and fajr). */
  | "qiyam"
  /** Every day, a quarter of an hour after sunrise: duha prayer's time has begun. */
  | "duha"
  /** Ramadan's timetable for the channel's city, as an image, on 27 Sha'ban. */
  | "imsakiya";

export type AyahContent = {
  type: "ayah";
  mode: "random" | "sequential";
  /**
   * smart = mostly short curated selections (1–3 ayat), otherwise a
   * medium-length thematic passage; always random.
   * passage = a whole thematic passage (ruku); short surahs are posted complete.
   * dua = one of the Quran's duas (src/lib/content/quran-duas.ts), at random.
   */
  unit: "smart" | "passage" | "ayah" | "page" | "dua";
  /** Consecutive ayat per post when unit = "ayah". */
  count: number;
  /** smart only: share of posts (0–100) taken from the short selections. Default 80. */
  shortPercent?: number;
  /** mushaf (default): an image of the ayat as printed in the Madinah mushaf, with the text as caption. text: text only. */
  display?: "mushaf" | "text";
};

export type AzkarContent = {
  type: "azkar";
  chapterIds: number[];
  /** full = the whole chapter(s) in order; random = one zikr per post. */
  mode: "full" | "random";
  title?: string;
  /** Media collection: a random image/video/PDF from it goes with the post. */
  media?: string;
  /**
   * full mode: an album of cards linking the interactive reader page (default),
   * one cover card (the title) with that link, or plain text.
   */
  display?: "cards" | "cover" | "text";
  /** With the album, on WhatsApp groups/channels: a link to the reader page (default), or the whole text. A cover always links. */
  waText?: "link" | "full";
};

export type CustomContent = { type: "custom"; text: string; media?: string };

/** The day's prayer times for the channel's city, optionally with an image card. */
/** `styles`: the image's looks (src/lib/prayer-card-styles.ts), one at random per post; «أخضر» when unset. */
export type PrayerTimesContent = { type: "prayer_times"; image: boolean; styles?: PrayerCardStyleId[] };

/** Fasting days, Ramadan, Dhul Hijjah, new Hijri month, Eid: whichever is due when it runs. */
export type OccasionsContent = {
  type: "occasions";
  /** Media collection per occasion, e.g. { eid: "العيد" }. */
  media?: Partial<Record<OccasionKind, string>>;
};

/** Friday: the Kahf reminder and salawat posts (which one is due follows `timing.kind: "friday"`), each with its own media. */
export type FridayContent = {
  type: "friday";
  /** e.g. "سورة الكهف" to send the Kahf PDF with the reminder. */
  kahfMedia?: string;
  /** Sent instead of the salawat ayah image when set. */
  salawatMedia?: string;
};

/** A short heads-up before a prayer; which prayer and how long before come from `timing.kind: "prayer"`. */
export type PrayerAlertContent = { type: "prayer_alert" };

export type ContentConfig =
  | PrayerAlertContent
  | AyahContent
  | AzkarContent
  | CustomContent
  | PrayerTimesContent
  | OccasionsContent
  | FridayContent;

/** Fixed schedule types: each shows only its own settings in the dashboard. */
export type ScheduleKind =
  | "prayer_times"
  | "morning"
  | "evening"
  | "sleep"
  | "quran"
  | "dhikr"
  | "salawat"
  | "friday"
  | "prayer_alert"
  | "occasions"
  | "announcement";

export type ScheduleState = {
  /** Position in the sequence (sequential) or in the shuffled order (random). */
  cursor?: number;
  /** Seed for the shuffled order; changes every full cycle so the order differs. */
  seed?: number;
  /** Second non-repeating order, used by "smart" for the short selections. */
  alt?: { cursor?: number; seed?: number };
};

/** Ways a «رسالة للجميع» reaches people (src/lib/broadcast-audience.ts). */
export type BroadcastTarget = "telegram" | "push" | "whatsapp" | "email";
/** Where each way (besides Telegram, which has its own columns) got to. `pausedUntil`: a daily limit was reached. */
export type BroadcastProgress = Partial<
  Record<"push" | "whatsapp" | "email", { cursor: string; sent: number; failed: number; total: number; done?: boolean; pausedUntil?: number }>
>;

export type JobPayload =
  /** `at`: build the post as of that time (a resend of one that failed, src/lib/jobs.ts `resendFailedWhatsApp`). */
  | { kind: "publish"; scheduleId: number; manual?: boolean; at?: number }
  | { kind: "custom"; channelId: number; text: string }
  | { kind: "sync_admins"; channelId: number }
  /** WhatsApp: re-read the account's groups and communities. */
  | { kind: "wa_refresh_chats"; accountId: number }
  /** WhatsApp: look up a channel by its invite link and check the account's role. */
  | { kind: "wa_add_newsletter"; accountId: number; invite: string }
  /** WhatsApp backup device (whatsapp-web.js): link the number (a pairing code) or unlink it. */
  | { kind: "wa_backup_link"; accountId: number }
  | { kind: "wa_backup_logout"; accountId: number }
  /** WhatsApp: delayed welcome + contact card for a new subscriber. */
  | { kind: "wa_welcome"; accountId: number; chatJid: string; subscriber: string; messageId?: string }
  /** The dashboard's answer to a user's /feedback message or report, sent to them in Telegram. */
  | { kind: "feedback_reply"; feedbackId: number }
  /** A new message or report from a user: the super admins hear of it in Telegram. */
  | { kind: "feedback_notify"; feedbackId: number }
  /** A group khatma changed on the website: update its message in the Telegram group (and announce a finished round). */
  | { kind: "gk_refresh"; khatmaId: number; finishedRound?: number };

/** What a «بلّغ عن خطأ» report is about. */
export type FeedbackContext = {
  type: "ayah" | "zikr" | "tafsir" | "page" | "other";
  /** "2:255", a Hisn item id, a page path… */
  ref?: string;
  /** A readable label, e.g. «سورة البقرة: ٢٥٥». */
  label?: string;
  /** Where on the site it was sent from. */
  url?: string;
};
