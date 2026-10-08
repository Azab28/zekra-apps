import path from "node:path";
import { GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import { env } from "../env";

/** Brand palette shared by generated images (matches the dashboard theme). */
export const COLORS = {
  bgTop: "#0a3a2c",
  bgBottom: "#0f5541",
  gold: "#d9b35b",
  goldSoft: "rgba(217, 179, 91, 0.35)",
  cream: "#f6f1e3",
  creamSoft: "rgba(246, 241, 227, 0.75)",
  panel: "rgba(255, 255, 255, 0.07)",
  panelStrong: "rgba(217, 179, 91, 0.16)",
};

export const FONT = { sans: "Plex Arabic", quran: "Amiri", mushaf: "LPMQ Isep Misbah", ayah: "Amiri Quran" };

/** CSS font shorthand with IBM Plex Arabic as fallback for glyphs a family lacks. */
export function font(weight: number, size: number, family: string = FONT.sans): string {
  return family === FONT.sans
    ? `${weight} ${size}px "${FONT.sans}"`
    : `${weight} ${size}px "${family}", "${FONT.sans}"`;
}

/** Line at the bottom of a channel's generated images: IMAGE_FOOTER, else its signature, @username or title. */
export function imageFooter(channel: { signature: string; username: string | null; title: string }): string {
  return env.imageFooter || channel.signature.trim() || (channel.username ? `@${channel.username}` : channel.title);
}

let fontsLoaded = false;
export function ensureFonts() {
  if (fontsLoaded) return;
  const dir = path.join(process.cwd(), "assets", "fonts");
  GlobalFonts.registerFromPath(path.join(dir, "IBMPlexSansArabic-Regular.ttf"), FONT.sans);
  GlobalFonts.registerFromPath(path.join(dir, "IBMPlexSansArabic-SemiBold.ttf"), FONT.sans);
  GlobalFonts.registerFromPath(path.join(dir, "IBMPlexSansArabic-Bold.ttf"), FONT.sans);
  GlobalFonts.registerFromPath(path.join(dir, "Amiri-Regular.ttf"), FONT.quran);
  GlobalFonts.registerFromPath(path.join(dir, "Amiri-Bold.ttf"), FONT.quran);
  GlobalFonts.registerFromPath(path.join(dir, "LPMQ-IsepMisbah.ttf"), FONT.mushaf);
  GlobalFonts.registerFromPath(path.join(dir, "AmiriQuran-Regular.ttf"), FONT.ayah);
  fontsLoaded = true;
}

export function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Eight-pointed star (two overlapping squares), the classic Islamic motif. */
export function star8(ctx: SKRSContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let k = 0; k < 16; k++) {
    const angle = (Math.PI / 8) * k - Math.PI / 2;
    const radius = k % 2 === 0 ? r : r * 0.72;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Emerald gradient background with a faint repeating star lattice. */
export function drawBackground(ctx: SKRSContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, COLORS.bgTop);
  g.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.strokeStyle = "rgba(217, 179, 91, 0.07)";
  ctx.lineWidth = 2;
  const step = 120;
  for (let y = 0; y <= h + step; y += step) {
    for (let x = (y / step) % 2 ? step / 2 : 0; x <= w + step; x += step) {
      star8(ctx, x, y, 40);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Soft vignette so the lattice fades toward the edges.
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

/** Gold star flanked by fading lines, used as a divider. */
export function drawDivider(ctx: SKRSContext2D, cx: number, y: number, halfWidth: number) {
  ctx.save();
  for (const dir of [-1, 1]) {
    const g = ctx.createLinearGradient(cx, y, cx + dir * halfWidth, y);
    g.addColorStop(0, COLORS.gold);
    g.addColorStop(1, "rgba(217, 179, 91, 0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + dir * 26, y);
    ctx.lineTo(cx + dir * halfWidth, y);
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.gold;
  star8(ctx, cx, y, 14);
  ctx.fill();
  ctx.restore();
}

/**
 * Wraps Latin runs such as "@channel" or "Azkar By Azab" in bidi isolates so
 * they keep their order inside right-to-left text (otherwise "@name" renders
 * as "name@" and multi-word names come out reversed).
 */
export function isolateLatin(text: string): string {
  return text.replace(/[@#]?[A-Za-z0-9][A-Za-z0-9_.\-]*(?: +[@#]?[A-Za-z0-9][A-Za-z0-9_.\-]*)*/g, (m) => "\u2066" + m + "\u2069");
}

/**
 * The Quran text puts a space before waqf (pause) marks, which leaves the
 * combining mark with no letter to sit on when drawn. Attach each mark to the
 * preceding word, as printed mushafs show it. Only whitespace changes.
 */
export function attachWaqfMarks(text: string): string {
  return text.replace(/ +([\u06D6-\u06DC])/g, "$1");
}

/** Draws text, shrinking the font until it fits `maxWidth`. */
export function fitText(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  weight: number,
  size: number,
  family: string = FONT.sans,
) {
  let s = size;
  ctx.font = font(weight, s, family);
  while (ctx.measureText(text).width > maxWidth && s > 12) {
    s -= 2;
    ctx.font = font(weight, s, family);
  }
  ctx.fillText(text, x, y);
}

/** Greedy word wrap for the current ctx.font. */
export function wrap(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}

/** Canvas fonts have no colour emoji; drop them (and their variation selectors). */
export const stripEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim();
