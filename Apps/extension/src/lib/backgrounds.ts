/**
 * Background photos for the glass themes: the curated Wikimedia Commons list
 * (extension/backgrounds.json, each with its author and license) or one from
 * the user's device. The next tab's photo is picked and preloaded ahead, and
 * written where boot.ts reads it, so a new tab opens with it already painted.
 */
import type { Settings } from "./settings";
import type { ExtBackground } from "./types";

export const BACKGROUNDS: ExtBackground[] = __BACKGROUNDS__;
export const bgById = (id: string | null) => BACKGROUNDS.find((b) => b.id === id) ?? null;

const CUSTOM_KEY = "bg.custom";
export type Shown = { src: string; color: string; bg: ExtBackground | null };

/** The photos the settings draw from (favourites fall back to all when none are marked). */
export function pool(s: Settings): ExtBackground[] {
  const { category, favorites } = s.background;
  if (category === "favorites") {
    const fav = BACKGROUNDS.filter((b) => favorites.includes(b.id));
    return fav.length ? fav : BACKGROUNDS;
  }
  return BACKGROUNDS.filter((b) => b.category === (category === "nature" ? "nature" : "islamic"));
}

export function randomFrom(list: ExtBackground[], not?: string | null): ExtBackground {
  const choices = list.length > 1 ? list.filter((b) => b.id !== not) : list;
  return choices[Math.floor(Math.random() * choices.length)];
}

export async function customBackground(): Promise<{ src: string; color: string } | null> {
  const got = await chrome.storage.local.get(CUSTOM_KEY);
  const v = got[CUSTOM_KEY] as { src: string; color: string } | undefined;
  return v?.src ? v : null;
}

/** A photo from the device, shrunk to the screen's size and kept in extension storage. */
export async function saveCustomBackground(file: File): Promise<{ src: string; color: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2560 / bitmap.width, 1600 / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const value = { src: canvas.toDataURL("image/jpeg", 0.85), color: averageColor(canvas) };
  await chrome.storage.local.set({ [CUSTOM_KEY]: value });
  return value;
}

function averageColor(source: CanvasImageSource): string {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(source, 0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

const store = (k: string, v: string | null) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {}
};

/** Shows a photo now and remembers it for the next tab's first paint. */
export function paint(shown: { src: string; color: string }, blur: number) {
  const root = document.documentElement;
  root.style.setProperty("--tint", shown.color);
  root.style.setProperty("--bg-image", `url("${shown.src.replace(/"/g, "%22")}")`);
  root.style.setProperty("--bg-blur", `${blur}px`);
  root.style.setProperty("--bg-blur-scale", String(blur * 0.004));
  store("bg.color", shown.color);
  store("bg.blur", String(blur));
}

/** Sets the photo the next tab opens with and warms the browser cache for it. */
export function prepareNext(next: { src: string; color: string; id: string | null }) {
  store("bg.src", next.src);
  store("bg.color", next.color);
  store("bg.id", next.id);
  if (!next.src.startsWith("data:")) new Image().src = next.src;
}

/** The photo boot.ts painted for this tab (picked by the previous one). */
export function preparedId(): string | null {
  try {
    return localStorage.getItem("bg.id");
  } catch {
    return null;
  }
}
