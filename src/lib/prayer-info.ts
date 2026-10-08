/**
 * What the /prayer page shows under a prayer when it's tapped: its rak'at,
 * whether it's recited aloud, and the sunnah prayed before and after it (the
 * well-known rawatib). Plain facts, no ayat or hadith text. Client-safe.
 */
import type { PrayerName } from "./types";

export type PrayerInfo = {
  rakaat: string;
  recitation: string;
  before: string;
  after: string;
  note?: string;
};

export const PRAYER_INFO: Record<Exclude<PrayerName, "sunrise"> | "jumuah", PrayerInfo> = {
  fajr: {
    rakaat: "ركعتان",
    recitation: "جهرية",
    before: "ركعتان (سنة الفجر)، وهي آكد السنن الرواتب",
    after: "لا سنة بعدها",
    note: "لا تطوّع بعد صلاة الفجر حتى تطلع الشمس وترتفع.",
  },
  dhuhr: {
    rakaat: "أربع ركعات",
    recitation: "سرية",
    before: "أربع ركعات (أو ركعتان)",
    after: "ركعتان",
  },
  jumuah: {
    rakaat: "ركعتان، تسبقهما خطبتان",
    recitation: "جهرية",
    before: "ليس لها راتبة قبلها، ويصلي ما تيسّر حتى يخرج الإمام",
    after: "أربع ركعات في المسجد، أو ركعتان في البيت",
  },
  asr: {
    rakaat: "أربع ركعات",
    recitation: "سرية",
    before: "ليس لها راتبة، ويُستحب أن يصلي قبلها أربع ركعات",
    after: "لا سنة بعدها",
    note: "لا تطوّع بعد صلاة العصر حتى تغرب الشمس.",
  },
  maghrib: {
    rakaat: "ثلاث ركعات",
    recitation: "جهرية في الركعتين الأوليين، وسرية في الثالثة",
    before: "ليس لها راتبة، ويُستحب ركعتان بين الأذان والإقامة",
    after: "ركعتان",
  },
  isha: {
    rakaat: "أربع ركعات",
    recitation: "جهرية في الركعتين الأوليين، وسرية في الأخريين",
    before: "ليس لها راتبة، ويُستحب ركعتان بين الأذان والإقامة",
    after: "ركعتان، ثم الوتر (ركعة أو أكثر) إلى الفجر",
  },
};

/** Sunrise isn't a prayer: the time ends Fajr's, and Duha begins once the sun is up. */
export const SUNRISE_NOTE = "ليس وقت صلاة: ينتهي عنده وقت الفجر، ولا يُصلّى حتى ترتفع الشمس قدر رمح (نحو ربع ساعة)، ثم يبدأ وقت صلاة الضحى.";
