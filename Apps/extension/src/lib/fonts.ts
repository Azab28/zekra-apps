/**
 * The Madinah mushaf's per-page fonts (QCF V2, quran.com's CDN), kept in the
 * extension's Cache Storage once fetched: a new tab draws its ayah from disk
 * instead of waiting on the network. Same family names as the site's loader.
 */
const CDN = "https://static.qurancdn.com/fonts/quran/hafs/v2/woff2";
const CACHE = "qcf-v2";

export const pageFamily = (page: number) => `qcf-p${page}`;

const loading = new Map<number, Promise<void>>();

async function bytes(page: number): Promise<ArrayBuffer> {
  const url = `${CDN}/p${page}.woff2`;
  const cache = await caches.open(CACHE);
  const hit = await cache.match(url);
  if (hit) return hit.arrayBuffer();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font ${page}: ${res.status}`);
  await cache.put(url, res.clone());
  return res.arrayBuffer();
}

export function loadPage(page: number): Promise<void> {
  let p = loading.get(page);
  if (!p) {
    p = bytes(page).then(async (data) => {
      const face = new FontFace(pageFamily(page), data, { display: "block" });
      document.fonts.add(await face.load());
    });
    p.catch(() => loading.delete(page));
    loading.set(page, p);
  }
  return p;
}

/** Fetches a page font into the cache without loading it into this page. */
export const prefetchPage = (page: number) => void bytes(page).catch(() => undefined);
