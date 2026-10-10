/**
 * Builds the browser extension (Apps/extension/) into Apps/extension/dist: bundles the
 * pages with esbuild, embeds what they show (the short ayat of the "smart"
 * mode with their mushaf glyph lines, azkar, radio stations) from data/*.json,
 * the rest of the Quran and its tafsir as files read on demand, the background
 * list (Apps/extension/backgrounds.json), draws the icons from Apps/extension/logo.svg and copies the UI
 * fonts (Google Fonts, cached in data/fonts/ext).
 *
 *   npm run ext:build              → Apps/extension/dist (Chrome; load it unpacked)
 *   npm run ext:build -- --browser=edge|firefox → Apps/extension/dist-edge, dist-firefox
 *   npm run ext:zip                → all three, and Apps/extension/zekra-<version>-{chrome,edge,firefox}.zip for the stores
 *
 * The builds differ (__BROWSER__, and files swapped by browserVariants): Chrome's
 * search box uses only the browser's own engine (its store's rule for a new
 * tab), Edge's and Firefox's pick an engine with Google's suggestions
 * (newtab/search.full.ts); Firefox plays audio in its background page
 * (lib/audio-host.firefox.ts: no offscreen documents there) and has its own
 * manifest (manifestFor).
 *   npm run ext:build -- --watch   → rebuild the scripts on change
 *   npm run ext:store              → the store icon and promo tiles (Apps/extension/store)
 *   npm run ext:shots              → the store screenshots from the built extension (Chrome for Testing)
 *
 * EXT_SITE_URL overrides the site the extension links and asks (https://zekra.site).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { crc32, deflateRawSync } from "node:zlib";
import { createCanvas, Path2D, type SKRSContext2D } from "@napi-rs/canvas";
import * as esbuild from "esbuild";
import { shortSurahName, stripTashkeel, toArabicDigits } from "../src/lib/content/arabic";
import { hisn, qcf, quran, radioStations, reciters, tafsirMuyassar } from "../src/lib/content/data";
import { SELECTED_AYAT } from "../src/lib/content/selected-ayat";
import { COLORS, drawBackground, ensureFonts, font } from "../src/lib/images/canvas";
import { MEMORIAL, plainDua } from "../src/lib/memorial";
import type { SurahMeta } from "../Apps/extension/src/lib/quran";
import type { ExtAyah, ExtBackground, ExtReciterRow, ExtStation, ExtZikr } from "../Apps/extension/src/lib/types";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "Apps", "extension", "src");
type Browser = "chrome" | "edge" | "firefox";
const BROWSERS: Browser[] = ["chrome", "edge", "firefox"];
/** Chrome's build is dist (what ext:shots loads); the others dist-<browser>. */
const distFor = (b: Browser) => path.join(ROOT, "Apps", "extension", b === "chrome" ? "dist" : `dist-${b}`);
/** The build being written (the helpers below copy their files into it). */
let OUT = distFor("chrome");
const FONT_CACHE = path.join(ROOT, "data", "fonts", "ext");
const SITE = (process.env.EXT_SITE_URL ?? "https://zekra.site").replace(/\/+$/, "");
const args = new Set(process.argv.slice(2));

// Hisn al-Muslim chapters in the new tab's azkar panel, one item at a time: istighfar, tasbeeh, salawat.
const ZIKR_CHAPTERS = [129, 130, 107];
const ZIKR_MAX_CHARS = 260;

// The icon: the «ذكرى» logo (Apps/extension/logo.svg, vector paths with linear gradients) on a light tile.
const LOGO = path.join(ROOT, "Apps", "extension", "logo.svg");
const TILE = "#fcfcf9";

const ICONS = [
  "settings", "refresh-cw", "play", "pause", "square", "book-open", "book-open-text", "copy", "check", "radio-tower",
  "map-pin", "bell", "search", "volume-2", "volume-x", "x", "external-link", "sun", "moon", "clock", "sparkles",
  "circle-dot", "headphones", "loader-circle", "locate-fixed", "calendar-days", "book-check", "compass",
  "monitor", "moon-star", "sunrise", "sun-medium", "sunset", "bell-off", "repeat", "repeat-1", "skip-back", "skip-forward",
  "ellipsis", "layout-grid", "grip-vertical", "plus", "image", "heart", "mic", "chevron-down", "link", "history",
  "upload", "shuffle", "info", "pencil", "folder", "folder-plus", "share-2", "download", "eye", "eye-off",
  "star", "pin", "list-todo", "notebook-pen", "bookmark", "puzzle", "app-window", "chevron-left", "chevron-right", "cloud-sun", "cloud", "cloud-fog", "cloud-drizzle",
  "cloud-rain", "snowflake", "cloud-lightning", "thermometer", "droplets", "wind", "panel-top", "panel-bottom", "panel-right", "panel-left", "hand-heart",
  "alarm-clock", "timer", "chevron-up", "star-off", "list-music", "arrow-right",
];

/** The curated short passages with their text (Tanzil) and each ayah's printed lines (QCF V2). */
function ayat(): ExtAyah[] {
  const q = quran();
  const glyphs = qcf().verses;
  return SELECTED_AYAT.map(([s, from, to]) => {
    const surah = q.surahs[s - 1];
    const rows = q.ayahs.slice(surah.start + from - 1, surah.start + to);
    return {
      s,
      from,
      to,
      text: rows.map((r) => `${r[4]} ۝${toArabicDigits(r[1])}`).join(" "),
      ayahLines: rows.map((r) => glyphs[`${s}:${r[1]}`] ?? []),
    };
  });
}

/** Index of each juz's first ayah. */
function juzStarts(): number[] {
  return quran().ayahs.flatMap((a, i, all) => (i === 0 || all[i - 1][3] !== a[3] ? [i] : []));
}

function surahs(): SurahMeta[] {
  return quran().surahs.map((s) => [shortSurahName(s.name), s.ayahCount, s.type === "Medinan", s.start]);
}

/** The rest of the Quran, read by the new tab only when the reader moves on (Apps/extension/dist/data). */
function dataFiles() {
  const dir = path.join(OUT, "data");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "qcf.json"), JSON.stringify(qcf().verses));
  writeFileSync(path.join(dir, "text.json"), JSON.stringify(quran().ayahs.map((a) => a[4])));
  writeFileSync(path.join(dir, "tafsir.json"), JSON.stringify(tafsirMuyassar()));
}

/** The adhan recordings (Apps/extension/adhan, from Quran Tab's widely shared set). */
function adhanFiles() {
  for (const dir of ["adhan", "zikr"]) {
    const src = path.join(ROOT, "Apps", "extension", dir);
    if (!existsSync(src)) {
      console.warn(`! no Apps/extension/${dir}: those sounds are left out`);
      continue;
    }
    mkdirSync(path.join(OUT, dir), { recursive: true });
    for (const f of readdirSync(src)) if (f.endsWith(".mp3")) copyFileSync(path.join(src, f), path.join(OUT, dir, f));
  }
}

/**
 * The zikr reminder's phrases (Apps/extension/zikr/<id>.mp3 says each), their
 * words taken out of hisn.json — never typed here. A phrase no longer found fails the build.
 */
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
      // The folded text, each letter remembering where it was in the original.
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
      while (end < text.length && /[\u064B-\u065F\u0670\u06D6-\u06ED]/.test(text[end])) end++;
      return { id, text: text.slice(at[k], end).trim() };
    }
    throw new Error(`zikr «${key}» is not in hisn.json`);
  });
}

/** The first-run guide's dedication: his name and the dua for the deceased, out of hisn.json (as on his page, /ali). */
function memorial() {
  const c = hisn().chapters.find((x) => x.id === MEMORIAL.dua.chapter);
  const z = c?.items.find((i) => i.id === MEMORIAL.dua.item);
  if (!c || !z) throw new Error(`the memorial dua (${MEMORIAL.dua.chapter}/${MEMORIAL.dua.item}) is not in hisn.json`);
  return { name: MEMORIAL.name, dua: plainDua(z.text), source: `حصن المسلم: ${c.title}` };
}

function backgrounds(): ExtBackground[] {
  return (JSON.parse(readFileSync(path.join(ROOT, "Apps", "extension", "backgrounds.json"), "utf8")) as { backgrounds: ExtBackground[] }).backgrounds;
}

function azkar(): ExtZikr[] {
  return hisn()
    .chapters.filter((c) => ZIKR_CHAPTERS.includes(c.id))
    .flatMap((c) => c.items.filter((i) => i.text.length <= ZIKR_MAX_CHARS).map((i) => ({ text: i.text.trim(), chapter: c.title })));
}

function stations(): ExtStation[] {
  return radioStations().map(({ id, name, url, group }) => ({ id, name, url, group }));
}

/** mp3quran.net recitations, compact: a full mushaf's surah list is 0. */
function recitations(): ExtReciterRow[] {
  return reciters().map((r) => [r.id, r.name, r.moshaf.map((m) => [m.id, m.name, m.server, m.surahs.length === 114 ? 0 : m.surahs] as const)]);
}

async function icons(): Promise<Record<string, [string, Record<string, string>][]>> {
  const out: Record<string, [string, Record<string, string>][]> = {};
  for (const name of ICONS) {
    const dir = path.join(ROOT, "node_modules", "lucide-react", "dist", "esm", "icons");
    let file = path.join(dir, `${name}.mjs`);
    // Renamed icons are re-exports of the new name.
    const alias = /export \{ default \} from '\.\/([\w-]+)\.mjs'/.exec(readFileSync(file, "utf8"));
    if (alias) file = path.join(dir, `${alias[1]}.mjs`);
    const mod = (await import(`file://${file.replace(/\\/g, "/")}`)) as { __iconData: { node: [string, Record<string, string>][] } };
    out[name] = mod.__iconData.node.map(([tag, attrs]) => [tag, Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== "key"))]);
  }
  return out;
}

type LogoPart = { d: string; from: [number, number]; to: [number, number]; stops: [number, string][] };

/** The logo's paths with their gradients, and the box they fill. */
function logo(): { parts: LogoPart[]; box: [number, number, number, number] } {
  const svg = readFileSync(LOGO, "utf8");
  const grads = new Map<string, Omit<LogoPart, "d">>();
  for (const m of svg.matchAll(/<linearGradient id="(\w+)" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"[^>]*>([\s\S]*?)<\/linearGradient>/g)) {
    const stops = [...m[6].matchAll(/offset="([\d.]+)" stop-color="(#[0-9a-fA-F]{6})"/g)].map((x) => [Number(x[1]), x[2]] as [number, string]);
    grads.set(m[1], { from: [Number(m[2]), Number(m[3])], to: [Number(m[4]), Number(m[5])], stops });
  }
  const parts = [...svg.matchAll(/<path d="([^"]+)" fill="url\(#(\w+)\)"/g)].map((m) => {
    const g = grads.get(m[2]);
    if (!g) throw new Error(`logo.svg: no gradient ${m[2]}`);
    return { d: m[1].replace(/\s+/g, " ").trim(), ...g };
  });
  if (!parts.length) throw new Error("logo.svg: no paths");
  const pts = parts.flatMap((p) => [...p.d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { parts, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}

function drawIcon(size: number): Buffer {
  const canvas = createCanvas(size, size);
  // Small toolbar sizes get a larger logo so it stays readable.
  drawLogoTile(canvas.getContext("2d"), 0, 0, size, size <= 32 ? 0.94 : 0.8);
  return canvas.toBuffer("image/png");
}

/** IBM Plex Sans Arabic (UI), Amiri (azkar) and Amiri Quran (the ayah when the mushaf fonts can't load), Arabic and Latin only. */
async function fonts(): Promise<string> {
  mkdirSync(FONT_CACHE, { recursive: true });
  const cssCache = path.join(FONT_CACHE, "fonts.css");
  let css: string;
  try {
    const res = await fetch(
      "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Amiri:wght@400;700&family=Amiri+Quran&display=swap",
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36" } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    css = await res.text();
    writeFileSync(cssCache, css);
  } catch (err) {
    if (!existsSync(cssCache)) {
      console.warn(`! fonts: ${(err as Error).message}; the extension will use system fonts`);
      return "";
    }
    css = readFileSync(cssCache, "utf8");
  }
  mkdirSync(path.join(OUT, "fonts"), { recursive: true });
  const blocks = css.split(/(?=\/\*\s*[\w-]+\s*\*\/)/).filter((b) => /^\/\*\s*(arabic|latin)\s*\*\//.test(b));
  const out: string[] = [];
  for (const block of blocks) {
    const url = /url\((https:[^)]+)\)/.exec(block)?.[1];
    if (!url) continue;
    const name = path.basename(new URL(url).pathname);
    const cached = path.join(FONT_CACHE, name);
    if (!existsSync(cached)) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`font ${url}: HTTP ${res.status}`);
      writeFileSync(cached, Buffer.from(await res.arrayBuffer()));
    }
    copyFileSync(cached, path.join(OUT, "fonts", name));
    out.push(block.replace(url, `fonts/${name}`).trim());
  }
  return out.join("\n");
}

/** A plain zip of the build (the stores take one). */
function zip(dir: string, file: string) {
  const entries: { name: string; data: Buffer }[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = path.join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else entries.push({ name: path.relative(dir, p).replace(/\\/g, "/"), data: readFileSync(p) });
    }
  };
  walk(dir);
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const packed = deflateRawSync(data, { level: 9 });
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(0, 10); // time/date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(20, 6);
    head.writeUInt16LE(0x0800, 8);
    head.writeUInt16LE(8, 10);
    head.writeUInt32LE(0, 12);
    head.writeUInt32LE(crc, 16);
    head.writeUInt32LE(packed.length, 20);
    head.writeUInt32LE(data.length, 24);
    head.writeUInt16LE(nameBuf.length, 28);
    head.writeUInt32LE(offset, 42);
    central.push(head, nameBuf);
    parts.push(local, nameBuf, packed);
    offset += local.length + nameBuf.length + packed.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  writeFileSync(file, Buffer.concat([...parts, centralBuf, end]));
}

// ---------- the store's images (npm run ext:store → Apps/extension/store) ----------

/** The logo on its light rounded tile, `size` square, at (x, y); the logo fills `inset` of it. */
function drawLogoTile(ctx: SKRSContext2D, x: number, y: number, size: number, inset = 0.8, mark = logo()) {
  ctx.save();
  ctx.fillStyle = TILE;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, size * 0.22);
  ctx.fill();
  const [x0, y0, x1, y1] = mark.box;
  const scale = (size * inset) / Math.max(x1 - x0, y1 - y0);
  ctx.translate(x + (size - (x1 - x0) * scale) / 2 - x0 * scale, y + (size - (y1 - y0) * scale) / 2 - y0 * scale);
  ctx.scale(scale, scale);
  for (const p of mark.parts) {
    const g = ctx.createLinearGradient(p.from[0], p.from[1], p.to[0], p.to[1]);
    for (const [at, color] of p.stops) g.addColorStop(at, color);
    ctx.fillStyle = g;
    ctx.fill(new Path2D(p.d), "evenodd");
  }
  ctx.restore();
}

/** A promo tile: the green background, the logo tile at the start (right), the name and a line beside it, and optional pills. */
function drawPromo(w: number, h: number, o: { tile: number; title: number; line: number; lines: string[]; pills?: string[]; pill?: number }): Buffer {
  ensureFonts();
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  drawBackground(ctx, w, h);
  const pad = Math.round(h * 0.16);
  const tileX = w - pad - o.tile;
  drawLogoTile(ctx, tileX, (h - o.tile) / 2, o.tile);
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  const right = tileX - Math.round(o.tile * 0.16);
  const pillH = o.pill ? o.pill * 2.1 : 0;
  // The name's descenders (the ي) need room before the first line.
  const gap = o.title * 0.32;
  const blockH = o.title * 1.05 + gap + o.lines.length * o.line * 1.55 + (o.pills ? pillH + o.line : 0);
  let y = (h - blockH) / 2 + o.title * 0.9;
  ctx.fillStyle = COLORS.cream;
  ctx.font = font(700, o.title);
  ctx.fillText("ذِكرى", right, y);
  y += gap;
  ctx.fillStyle = COLORS.creamSoft;
  ctx.font = font(400, o.line);
  for (const line of o.lines) {
    y += o.line * 1.55;
    ctx.fillText(line, right, y);
  }
  if (o.pills && o.pill) {
    y += o.line * 0.9;
    let x = right;
    ctx.font = font(600, o.pill);
    for (const text of o.pills) {
      const tw = ctx.measureText(text).width + o.pill * 1.6;
      ctx.fillStyle = COLORS.panelStrong;
      ctx.beginPath();
      ctx.roundRect(x - tw, y, tw, pillH, pillH / 2);
      ctx.fill();
      ctx.fillStyle = COLORS.gold;
      ctx.fillText(text, x - o.pill * 0.8, y + pillH * 0.66);
      x -= tw + o.pill * 0.7;
    }
  }
  return canvas.toBuffer("image/png");
}

function storeImages() {
  const dir = path.join(ROOT, "Apps", "extension", "store");
  mkdirSync(dir, { recursive: true });
  // The store icon: 96 px of artwork with 16 px of clear space around it.
  const icon = createCanvas(128, 128);
  drawLogoTile(icon.getContext("2d"), 16, 16, 96);
  writeFileSync(path.join(dir, "icon-128.png"), icon.toBuffer("image/png"));
  writeFileSync(path.join(dir, "promo-small-440x280.png"), drawPromo(440, 280, { tile: 150, title: 50, line: 17, lines: ["آية ومواقيت الصلاة والأذكار", "في كل تبويب جديد"] }));
  writeFileSync(
    path.join(dir, "promo-marquee-1400x560.png"),
    drawPromo(1400, 560, {
      tile: 330,
      title: 120,
      line: 38,
      lines: ["آية من المصحف ومواقيت الصلاة والأذكار في كل تبويب جديد"],
      pills: ["الأذان والتنبيهات", "إذاعات وتلاوات", "ورد الاستماع", "المهام والملاحظات"],
      pill: 24,
    }),
  );
  console.log(`store images: ${path.relative(ROOT, dir)}`);
}

// ---------- the store's screenshots (npm run ext:shots, after a build) ----------

/** What the screenshots show: a place, a look, a photo, a few favourites. */
const SHOT_SETTINGS = {
  place: { city: "القاهرة", timezone: "Africa/Cairo", latitude: 30.0444, longitude: 31.2357, calcMethod: "Egyptian", madhab: "shafi" },
  theme: "glass-dark",
  background: { category: "islamic", id: "isl-32", auto: false, blur: 0, favorites: [] },
  listen: { wird: { on: true, reciter: "Alafasy_128kbps" }, stations: [], reciters: [123] },
};

/** A popup screenshot on the green background with a heading beside it, 1280×800. */
async function popupShot(png: Uint8Array, title: string, lines: string[]): Promise<Buffer> {
  ensureFonts();
  const { loadImage } = await import("@napi-rs/canvas");
  const canvas = createCanvas(1280, 800);
  const ctx = canvas.getContext("2d");
  drawBackground(ctx, 1280, 800);
  const img = await loadImage(Buffer.from(png));
  const scale = Math.min(1.3, 700 / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = 1280 - 140 - w;
  const y = (800 - h) / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  const right = x - 90;
  let ty = 800 / 2 - (lines.length * 52) / 2;
  ctx.fillStyle = COLORS.cream;
  ctx.font = font(700, 64);
  ctx.fillText(title, right, ty);
  ctx.fillStyle = COLORS.creamSoft;
  ctx.font = font(400, 30);
  for (const line of lines) {
    ty += 58;
    ctx.fillText(line, right, ty);
  }
  return canvas.toBuffer("image/jpeg", 92);
}

/** Screenshots for the stores (1280×800 JPEG, no alpha) from the built extension loaded in Chrome for Testing. */
async function screenshots() {
  if (!existsSync(path.join(OUT, "manifest.json"))) throw new Error("build first: npm run ext:build");
  const dir = path.join(ROOT, "Apps", "extension", "store");
  mkdirSync(dir, { recursive: true });
  const puppeteer = (await import("puppeteer")).default;
  // The installed Chrome when puppeteer's own isn't downloaded (CHROME_PATH overrides).
  const installed = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const browser = await puppeteer.launch({ headless: true, pipe: true, enableExtensions: [OUT], ...(existsSync(installed) ? { executablePath: installed } : {}), args: ["--lang=ar", "--autoplay-policy=no-user-gesture-required"] });
  try {
    const worker = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().endsWith("/background.js"));
    // URL.origin is "null" for chrome-extension: URLs.
    const base = `chrome-extension://${new URL(worker.url()).host}`;
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    const set = (value: object) => page.evaluate((v) => chrome.storage.local.set(v), value);
    const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const open = async (hash = "") => {
      // A hash alone would not load the page again.
      await page.goto("about:blank");
      await page.goto(`${base}/newtab.html${hash}`, { waitUntil: "networkidle2" });
      await settle(3500);
    };
    const shoot = async (name: string) => {
      await page.screenshot({ path: path.join(dir, name), type: "jpeg", quality: 92 });
      console.log(`screenshot: ${name}`);
    };

    await page.goto(`${base}/newtab.html`);
    await set({ settings: SHOT_SETTINGS });
    // Twice: the first load picks and stores the photo the next one paints before load.
    await open();
    await open();
    await shoot("screenshot-1-newtab.jpg");

    await set({ settings: { ...SHOT_SETTINGS, theme: "glass-light", tafsir: true, background: { ...SHOT_SETTINGS.background, id: "isl-03" } } });
    await open();
    await open();
    await shoot("screenshot-2-newtab-light.jpg");

    await set({ settings: { ...SHOT_SETTINGS, background: { ...SHOT_SETTINGS.background, id: "isl-33" } } });
    await open();
    await open("#settings-prayer");
    await page.type(".geo input", "القاهرة");
    await page.keyboard.press("Enter");
    await settle(4000);
    await shoot("screenshot-3-settings.jpg");

    // The popup on its own page, 360 px wide.
    const popup = await browser.newPage();
    await popup.setViewport({ width: 360, height: 700, deviceScaleFactor: 2 });
    await popup.goto(`${base}/popup.html`);
    await popup.evaluate(() => chrome.runtime.sendMessage({ type: "radio:play", track: { kind: "surah", moshaf: 123, surah: 18 } }));
    await popup.reload({ waitUntil: "networkidle2" });
    await settle(6000);
    const body1 = await popup.$("body");
    writeFileSync(
      path.join(dir, "screenshot-4-recitations.jpg"),
      await popupShot(await body1!.screenshot({ type: "png" }), "الإذاعة والتلاوات", ["إذاعات مباشرة وتلاوات أكثر من ٢٠٠ قارئ", "تكمل من حيث توقفت، مع مؤقت للإيقاف", "سور مقترحة حسب الوقت وورد يومي"]),
    );
    console.log("screenshot: screenshot-4-recitations.jpg");

    await popup.click('[role="tab"]:nth-child(2)');
    await settle(800);
    await popup.click('.player-row .icon-btn[aria-label="مؤقت الإيقاف"]').catch(() => undefined);
    await settle(500);
    const body2 = await popup.$("body");
    writeFileSync(
      path.join(dir, "screenshot-5-radio.jpg"),
      await popupShot(await body2!.screenshot({ type: "png" }), "إذاعات القرآن الكريم", ["بث مباشر لإذاعات القرّاء والبرامج", "المفضلة وآخر ما استمعت إليه", "منبّه بالقرآن قبل الفجر"]),
    );
    console.log("screenshot: screenshot-5-radio.jpg");
    await popup.evaluate(() => chrome.runtime.sendMessage({ type: "radio:stop" }));
  } finally {
    await browser.close();
  }
}

type Manifest = Record<string, unknown> & { permissions: string[]; optional_permissions?: string[]; version: string };

const SUGGEST_HOST = "https://suggestqueries.google.com/*";

/**
 * Each store's manifest from Apps/extension/manifest.json (Chrome's): Edge
 * adds the optional host for search suggestions and drops «search»; Firefox
 * has a background page instead of a service worker, no offscreen documents,
 * favicon API or managing other add-ons, and declares its id and data collection
 * (the place for prayer times and weather goes to OpenStreetMap and Open-Meteo).
 * No host permission anywhere: the site's two endpoints the extension calls
 * answer cross-origin (CORS) or aren't read (no-cors).
 */
function manifestFor(b: Browser): Manifest {
  const m = JSON.parse(readFileSync(path.join(ROOT, "Apps", "extension", "manifest.json"), "utf8")) as Manifest;
  if (b === "chrome") return m;
  const drop = (list: string[] | undefined, ...names: string[]) => (list ?? []).filter((p) => !names.includes(p));
  m.optional_host_permissions = [SUGGEST_HOST];
  m.permissions = drop(m.permissions, "search");
  if (b === "edge") return m;
  m.permissions = drop(m.permissions, "offscreen", "favicon");
  m.optional_permissions = drop(m.optional_permissions, "management");
  m.background = { scripts: ["background.js"] };
  delete m.minimum_chrome_version;
  m.browser_specific_settings = {
    gecko: { id: "zekra@zekra.site", strict_min_version: "140.0", data_collection_permissions: { required: ["locationInfo"] } },
    // The data collection key came to Firefox for Android in 142.
    gecko_android: { strict_min_version: "142.0" },
  };
  return m;
}

/** Files that differ by store, by the import's last name: Chrome's are the plain files. */
function browserVariants(b: Browser): esbuild.Plugin {
  const swaps: Record<string, string> = b === "chrome" ? {} : { search: "search.full", ...(b === "firefox" ? { "audio-host": "audio-host.firefox" } : {}) };
  return {
    name: "browser-variants",
    setup(build) {
      build.onResolve({ filter: /(^|\/)(search|audio-host)$/ }, (a) => {
        const to = swaps[a.path.split("/").pop()!];
        return to ? { path: path.join(a.resolveDir, a.path.replace(/[^/]+$/, `${to}.ts`)) } : undefined;
      });
    },
  };
}

async function main() {
  if (args.has("--store")) return storeImages();
  if (args.has("--shots")) return screenshots();
  const chosen = [...args].find((a) => a.startsWith("--browser="))?.slice("--browser=".length) as Browser | undefined;
  if (chosen && !BROWSERS.includes(chosen)) throw new Error(`--browser must be one of ${BROWSERS.join(", ")}`);
  const builds = args.has("--zip") ? BROWSERS : [chosen ?? "chrome"];
  for (const b of builds) await build(b);
}

async function build(b: Browser) {
  OUT = distFor(b);
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(path.join(OUT, "icons"), { recursive: true });

  const manifest = manifestFor(b);
  writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));

  for (const size of [16, 32, 48, 128]) writeFileSync(path.join(OUT, "icons", `${size}.png`), drawIcon(size));
  for (const f of readdirSync(SRC)) if (/\.(html|css)$/.test(f) && !(b === "firefox" && f === "offscreen.html")) copyFileSync(path.join(SRC, f), path.join(OUT, f));
  writeFileSync(path.join(OUT, "fonts.css"), await fonts());
  dataFiles();
  adhanFiles();

  const options: esbuild.BuildOptions = {
    entryPoints: ["background", "newtab", "popup", ...(b === "firefox" ? [] : ["offscreen"]), "boot"].map((n) => path.join(SRC, `${n}.ts`)),
    outdir: OUT,
    bundle: true,
    format: "iife",
    target: b === "firefox" ? "firefox140" : "chrome127",
    plugins: [browserVariants(b)],
    minify: !args.has("--watch"),
    // Errors in Chrome point at the source files in a local build; the store zip goes without maps.
    sourcemap: args.has("--zip") ? false : "linked",
    legalComments: "none",
    logLevel: "info",
    define: {
      __SITE__: JSON.stringify(SITE),
      __BROWSER__: JSON.stringify(b),
      __ICONS__: JSON.stringify(await icons()),
      __AYAT__: JSON.stringify(ayat()),
      __AZKAR__: JSON.stringify(azkar()),
      __STATIONS__: JSON.stringify(stations()),
      __RECITERS__: JSON.stringify(recitations()),
      __SURAHS__: JSON.stringify(surahs()),
      __JUZ__: JSON.stringify(juzStarts()),
      __ZIKR__: JSON.stringify(zikrPhrases()),
      __BACKGROUNDS__: JSON.stringify(backgrounds()),
      __MEMORIAL__: JSON.stringify(memorial()),
    },
  };
  if (args.has("--watch")) {
    await (await esbuild.context(options)).watch();
    return;
  }
  await esbuild.build(options);

  if (args.has("--zip")) {
    const file = path.join(ROOT, "Apps", "extension", `zekra-${manifest.version}-${b}.zip`);
    zip(OUT, file);
    console.log(`zip: ${path.relative(ROOT, file)}`);
  }
  console.log(`${path.relative(ROOT, OUT)} ready for ${b} (site ${SITE})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
