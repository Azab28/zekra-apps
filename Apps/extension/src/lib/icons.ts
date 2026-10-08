/**
 * Site icons for the shortcuts: Chrome's own (what it shows in tabs, so it
 * changes once the site is visited) when it has a real one, else Google's
 * icon service by the site's address only (never a path or query: they can
 * be private; Docs, Sheets and Slides keep their first folder to get their
 * own icon). Kept per URL in local storage for a week; «تحديث الأيقونات» looks again.
 */
const KEY = "dock.iconCache";
const WEEK = 7 * 86_400_000;
type Entry = { src: string; at: number };

let cache: Record<string, Entry> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const pending = new Map<string, Promise<string>>();

/** What Google's icon service is told: the site, plus the product folder on docs.google.com. */
function siteOnly(url: string): string {
  try {
    const u = new URL(url);
    const folder = u.hostname === "docs.google.com" ? /^\/(document|spreadsheets|presentation|forms)\//.exec(u.pathname)?.[1] : undefined;
    return `${u.origin}/${folder ? `${folder}/` : ""}`;
  } catch {
    return url;
  }
}

/** Google's icon for the site (works for sites never visited). */
export const serviceIcon = (url: string) =>
  `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64&url=${encodeURIComponent(siteOnly(url))}`;

/** The browser's own icon for a page (nothing leaves the computer). */
export const chromeIcon = (url: string, size = 64) => `${chrome.runtime.getURL("/_favicon/")}?pageUrl=${encodeURIComponent(url)}&size=${size}`;

async function load() {
  cache ??= ((await chrome.storage.local.get(KEY))[KEY] as Record<string, Entry> | undefined) ?? {};
  return cache;
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void chrome.storage.local.set({ [KEY]: cache }), 500);
}

/** The picture an image draws to, as a data URL (null when it can't load). */
function pixels(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      c.getContext("2d")!.drawImage(img, 0, 0, 64, 64);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Chrome's globe for sites it has no icon for: compared against to tell a real icon. */
let globe: Promise<string | null> | undefined;
const defaultIcon = () => (globe ??= pixels(chromeIcon("https://no-icon.invalid/")));

async function resolve(url: string): Promise<string> {
  // Firefox has no favicon API for extensions.
  if (__BROWSER__ === "firefox") return serviceIcon(url);
  const [own, plain] = await Promise.all([pixels(chromeIcon(url)), defaultIcon()]);
  return own && own !== plain ? own : serviceIcon(url);
}

/** The icon now (from the cache, or the service while Chrome's is looked up), and `onBetter` if a better one turns up. */
export function iconFor(url: string, onBetter: (src: string) => void): string {
  const hit = cache?.[url];
  if (hit && Date.now() - hit.at < WEEK) return hit.src;
  let p = pending.get(url);
  if (!p) {
    p = load().then(async (c) => {
      const src = await resolve(url);
      c[url] = { src, at: Date.now() };
      persist();
      return src;
    });
    pending.set(url, p);
  }
  void p.then((src) => src !== (hit?.src ?? serviceIcon(url)) && onBetter(src));
  return hit?.src ?? serviceIcon(url);
}

/** Loads the cache before the first draw (so icons appear at once). */
export const warmIcons = () => load();

/** «تحديث الأيقونات»: forget them all; each is looked up again on the next draw. */
export async function resetIcons() {
  cache = {};
  pending.clear();
  await chrome.storage.local.remove(KEY);
}
