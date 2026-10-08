/** Wallpaper sizes for /api/mushaf-image (checked there, offered by the site's buttons). Client-safe. */
export type WallSize = { w: number; h: number };

/** The phone wallpaper (the default). */
export const PHONE_WALL: WallSize = { w: 1080, h: 1920 };
export const WALL_MIN = 320;
/** Up to 4K either way (a portrait monitor too), and not more pixels than 3840×2400. */
export const WALL_MAX = 3840;
const WALL_MAX_PIXELS = 3840 * 2400;

/** A requested size, or null when it's out of range. */
export function wallSize(w: number, h: number): WallSize | null {
  if (!Number.isInteger(w) || !Number.isInteger(h)) return null;
  if (w < WALL_MIN || h < WALL_MIN || w > WALL_MAX || h > WALL_MAX || w * h > WALL_MAX_PIXELS) return null;
  return { w, h };
}

/** A screen's size brought within range, keeping its shape (a 5K or 8K screen gets 4K). */
export function fitWall(w: number, h: number): WallSize {
  let s = Math.min(1, WALL_MAX / w, WALL_MAX / h, Math.sqrt(WALL_MAX_PIXELS / (w * h)));
  s = Math.max(s, WALL_MIN / Math.min(w, h));
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

/** Common computer screens, for the custom size picker. */
export const WALL_PRESETS: { label: string; size: WallSize }[] = [
  { label: "Full HD", size: { w: 1920, h: 1080 } },
  { label: "2K", size: { w: 2560, h: 1440 } },
  { label: "4K", size: { w: 3840, h: 2160 } },
  { label: "لابتوب", size: { w: 1366, h: 768 } },
  { label: "MacBook", size: { w: 2880, h: 1800 } },
  { label: "شاشة عريضة", size: { w: 3440, h: 1440 } },
];
