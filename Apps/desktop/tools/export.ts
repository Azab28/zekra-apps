/**
 * The desktop app's data, taken from the site's own code and data files (never typed here):
 *   data <out.json>     cities, calculation methods, labels, Hijri month names, azkar from hisn.json
 *   fixture <out.json>  prayer times and Hijri dates as the site computes them, for Zekra.Tests
 *   icon <out.ico>      the app and tray icon: the logo on white, as src/app/favicon.ico (scripts/dev/app-icons.ts)
 * Run from the repository root: node --import tsx Apps/desktop/tools/export.ts data <out>
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { DateTime } from "luxon";
import { CITIES } from "../../../src/lib/cities";
import { stripTashkeel } from "../../../src/lib/content/arabic";
import { hisn } from "../../../src/lib/content/data";
import { hijriLabel, hijriMonthName, hijriOf } from "../../../src/lib/hijri-core";
import { drawLogo, logoWidth } from "../../../src/lib/images/brand";
import { LOGO_GOLD, LOGO_GOLD_PATH, LOGO_GREEN, LOGO_GREEN_PATH, LOGO_VIEWBOX } from "../../../src/lib/logo";
import { CALC_METHODS, PRAYER_LABELS, PRAYER_NAMES, prayerTimesFor, type Place } from "../../../src/lib/schedule/prayer-calc";

const [mode, out] = process.argv.slice(2);
if (!out || !["data", "fixture", "icon"].includes(mode)) throw new Error("usage: export.ts data|fixture|icon <out>");

/** Hisn al-Muslim: the dua after the adhan («اللهم رب هذه الدعوة التامة»). */
const ADHAN_DUA_ITEM = 25;

/** Same phrases and matching as zikrPhrases() in scripts/build-extension.ts (the extension's zikr reminder). */
const ZIKR_KEYS: [id: string, key: string][] = [
  ["tasbih", "سبحان الله"],
  ["hamd", "الحمد لله"],
  ["taohid", "لا إله إلا الله"],
  ["takbir", "الله أكبر"],
  ["istghfar", "أستغفر الله"],
  ["haoqala", "لا حول ولا قوة إلا بالله"],
  ["sal_ala_muhammad_waalih", "اللهم صل على محمد وعلى آل محمد"],
  ["tasbih_wahamd", "سبحان الله وبحمده"],
  ["tasbih_wahamd_2", "سبحان الله وبحمده سبحان الله العظيم"],
];

function zikrPhrases(): { id: string; text: string }[] {
  const fold = (t: string) =>
    stripTashkeel(t)
      .replace(/[إأآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/[ـ،,.؛()]/g, "")
      .replace(/\s+/g, " ");
  const items = hisn().chapters.flatMap((c) => c.items.map((i) => i.text));
  return ZIKR_KEYS.map(([id, key]) => {
    const want = fold(key);
    for (const text of items) {
      const at: number[] = [];
      let folded = "";
      for (let i = 0; i < text.length; i++)
        for (const x of fold(text[i])) {
          if (x === " " && folded.endsWith(" ")) continue;
          folded += x;
          at.push(i);
        }
      const k = folded.indexOf(want);
      if (k < 0) continue;
      let end = at[k + want.length - 1] + 1;
      while (end < text.length && /[ً-ٰٟۖ-ۭ]/.test(text[end])) end++;
      return { id, text: text.slice(at[k], end).trim() };
    }
    throw new Error(`zikr «${key}» is not in hisn.json`);
  });
}

/** Month number → name as the site writes it. */
function hijriMonths(): string[] {
  const names: string[] = [];
  for (let d = DateTime.utc(2026, 1, 1); names.filter(Boolean).length < 12; d = d.plus({ days: 1 }))
    names[hijriOf(d).month - 1] ??= hijriMonthName(d);
  return names;
}

/**
 * Where each Hijri month starts, as the site's Intl (ICU) Umm al-Qura calendar has it: .NET's
 * UmAlQuraCalendar follows another table before 1420 and after 1450 AH.
 */
function hijriTable() {
  const starts: number[] = [];
  let first: { year: number; month: number } | undefined;
  for (let d = DateTime.utc(1989, 11, 1); d.year <= 2100; d = d.plus({ days: 1 })) {
    const h = hijriOf(d);
    if (h.day !== 1) continue;
    first ??= { year: h.year, month: h.month };
    starts.push(Math.round(d.toSeconds() / 86400));
  }
  return { ...first!, starts };
}

/** The extension's adhan recordings (Apps/extension/adhan/<id>.mp3), which the app's build copies. */
async function adhanVoices() {
  // settings.ts reads the extension build's __SITE__ when it loads.
  Object.assign(globalThis, { __SITE__: "https://zekra.site" });
  const { ADHAN_VOICES } = await import("../../extension/src/lib/settings");
  return ADHAN_VOICES.map(([id, name]) => {
    if (!existsSync(path.join("Apps", "extension", "adhan", `${id}.mp3`))) throw new Error(`adhan ${id}.mp3 is missing`);
    return { id, name };
  });
}

async function data() {
  const chapters = hisn().chapters;
  const dua = chapters.flatMap((c) => c.items).find((i) => i.id === ADHAN_DUA_ITEM);
  if (!dua) throw new Error(`hisn item ${ADHAN_DUA_ITEM} is missing`);
  return {
    cities: CITIES,
    methods: Object.entries(CALC_METHODS).map(([id, m]) => ({ id, label: m.label })),
    prayerLabels: PRAYER_LABELS,
    hijriMonths: hijriMonths(),
    hijri: hijriTable(),
    zikr: zikrPhrases(),
    adhanVoices: await adhanVoices(),
    // The dua itself: hisn.json wraps it as «يَقُولُ: ((…))».
    adhanDua: dua.text.slice(dua.text.indexOf("((") + 2, dua.text.lastIndexOf("))")).trim(),
    logo: { viewBox: LOGO_VIEWBOX, green: LOGO_GREEN_PATH, gold: LOGO_GOLD_PATH, greenStops: LOGO_GREEN, goldStops: LOGO_GOLD },
    azkar: chapters.map((c) => ({ id: c.id, title: c.title, items: c.items.map((i) => ({ text: i.text, repeat: i.repeat })) })),
  };
}

type Row = { lat: number; lng: number; method: string; madhab?: Place["madhab"]; adjust?: Record<string, number>; date: string; times: (number | null)[] };

function fixture() {
  const rows: Row[] = [];
  const add = (p: Omit<Place, "timezone">, day: DateTime) => {
    const t = prayerTimesFor(day, { ...p, timezone: "UTC" });
    rows.push({
      lat: p.latitude,
      lng: p.longitude,
      method: p.calcMethod,
      ...(p.madhab ? { madhab: p.madhab } : {}),
      ...(p.prayerAdjust ? { adjust: p.prayerAdjust as Record<string, number> } : {}),
      date: day.toISODate()!,
      // Epoch minutes; adhan rounds to the nearest minute. null for a time that doesn't exist that day.
      times: PRAYER_NAMES.map((n) => (Number.isNaN(t[n].getTime()) ? null : t[n].getTime() / 60000)),
    });
  };
  const start = DateTime.utc(2026, 1, 1);
  // Every listed city with its own method, every other day for two years.
  for (const c of CITIES) for (let i = 0; i < 730; i += 2) add(c, start.plus({ days: i }));
  // Every method and madhab, with adjustments, on cities from the equator to the Arctic.
  const extra = [
    { latitude: 59.9139, longitude: 10.7522 }, // Oslo
    { latitude: 64.1466, longitude: -21.9426 }, // Reykjavik
    { latitude: 69.6492, longitude: 18.9553 }, // Tromsø (no sunrise in winter)
    { latitude: -33.9249, longitude: 18.4241 }, // Cape Town
    { latitude: -33.8688, longitude: 151.2093 }, // Sydney
    { latitude: 61.2181, longitude: -149.9003 }, // Anchorage
  ];
  const places = [...CITIES.filter((_, i) => i % 4 === 0), ...extra];
  let n = 0;
  for (const method of Object.keys(CALC_METHODS))
    for (const madhab of [undefined, "hanafi"] as const)
      for (const p of places)
        for (let i = 0; i < 730; i += 9) {
          const adjust = n++ % 3 === 0 ? { fajr: (n % 61) - 30, dhuhr: 2, isha: -((n % 7) + 1) } : undefined;
          add({ latitude: p.latitude, longitude: p.longitude, calcMethod: method, madhab, prayerAdjust: adjust }, start.plus({ days: i }));
        }
  // Hijri: every day the .NET Umm al-Qura calendar covers, then a few offsets with the labels.
  const hijri: string[] = [];
  const from = DateTime.utc(1990, 1, 1);
  for (let d = from; d.year < 2077; d = d.plus({ days: 1 })) {
    const h = hijriOf(d);
    hijri.push(`${h.year}-${h.month}-${h.day}`);
  }
  const labels: { date: string; offset: number; label: string; hijri: string }[] = [];
  for (let i = 0; i < 400; i += 3)
    for (const offset of [-2, -1, 0, 1, 2]) {
      const d = start.plus({ days: i });
      const h = hijriOf(d, offset);
      labels.push({ date: d.toISODate()!, offset, label: hijriLabel(d, offset), hijri: `${h.year}-${h.month}-${h.day}` });
    }
  return { prayers: rows, hijriFrom: from.toISODate(), hijri, labels };
}

/** The logo on a white rounded square, as the favicon draws it, in the sizes Windows asks for. */
function icon() {
  const pngs = [16, 20, 24, 32, 40, 48, 64, 256].map((size) => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, size * 0.22);
    ctx.fill();
    drawLogo(ctx, size / 2, size / 2, (size * (size <= 48 ? 0.96 : 0.8)) / logoWidth(1));
    return { size, data: canvas.toBuffer("image/png") };
  });
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, e);
    head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.data)]);
}

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, mode === "icon" ? icon() : JSON.stringify(mode === "data" ? await data() : fixture()));
