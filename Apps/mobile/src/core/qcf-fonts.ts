/**
 * The Madinah mushaf's per-page King Fahd fonts (QCF V2) and the surah-name
 * font, from the quran.com CDN as the site and the extension use them, but as
 * TrueType (phones don't load WOFF2); and the colour-coded tajweed edition
 * (QCF V4, the same glyph codes in COLRv1 colours) from Quran Foundation's
 * CDN, as the site's. Each file is downloaded once into the app's documents,
 * so pages read once open without a connection.
 */
import { Directory, File, Paths } from "expo-file-system";
import * as Font from "expo-font";
import { Platform } from "react-native";

const CDN = "https://static.qurancdn.com/fonts/quran";
const V4 = "https://verses.quran.foundation/fonts/quran/hafs/v4/colrv1";

export const pageFamily = (page: number, tajweed = false) => (tajweed ? `qcf4-p${page}` : `qcf-p${page}`);

/** COLRv1 colour fonts are drawn by Android 13 and newer; elsewhere the tajweed letters would show in one colour. */
export const TAJWEED_SUPPORTED = Platform.OS === "android" && Number(Platform.Version) >= 33;
export const NAMES_FAMILY = "qcf-surah-names";

const dir = () => {
  const d = new Directory(Paths.document, "qcf");
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
};

const loading = new Map<string, Promise<void>>();

function loadFont(family: string, file: string, url: string, sub?: string): Promise<void> {
  if (Font.isLoaded(family)) return Promise.resolve();
  let p = loading.get(family);
  if (!p) {
    p = (async () => {
      let folder = dir();
      if (sub) {
        folder = new Directory(folder, sub);
        if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
      }
      const target = new File(folder, file);
      if (!target.exists || !target.size) await File.downloadFileAsync(url, target, { idempotent: true });
      try {
        await Font.loadAsync({ [family]: target.uri });
      } catch (e) {
        // A broken or partial download: drop it so the next try fetches it again.
        target.delete();
        throw e;
      }
    })();
    p.catch(() => loading.delete(family));
    loading.set(family, p);
  }
  return p;
}

export const loadPageFont = (page: number, tajweed = false) =>
  tajweed ? loadFont(pageFamily(page, true), `p${page}.ttf`, `${V4}/ttf/p${page}.ttf`, "v4") : loadFont(pageFamily(page), `p${page}.ttf`, `${CDN}/hafs/v2/ttf/p${page}.ttf`);
export const loadNamesFont = () => loadFont(NAMES_FAMILY, "sura_names.ttf", `${CDN}/surah-names/v1/sura_names.ttf`);

// ---------- the whole mushaf, for reading offline ----------

const pageFile = (page: number, tajweed: boolean) => (tajweed ? new File(new Directory(dir(), "v4"), `p${page}.ttf`) : new File(dir(), `p${page}.ttf`));
const pageUrl = (page: number, tajweed: boolean) => (tajweed ? `${V4}/ttf/p${page}.ttf` : `${CDN}/hafs/v2/ttf/p${page}.ttf`);

/** How many of the 604 page fonts are on the phone (the plain or the tajweed edition). */
export function savedPages(tajweed = false): number {
  let count = 0;
  for (let p = 1; p <= 604; p++) if (pageFile(p, tajweed).exists) count++;
  return count;
}

/**
 * Downloads every page font not on the phone yet (four at a time), so the
 * whole mushaf opens without a connection; `onProgress(done, total)`. Stops
 * early with `signal`; returns how many failed.
 */
export async function downloadAllPages(tajweed: boolean, onProgress: (done: number, total: number) => void, signal: AbortSignal): Promise<number> {
  if (tajweed) {
    const v4 = new Directory(dir(), "v4");
    if (!v4.exists) v4.create({ intermediates: true, idempotent: true });
  }
  const todo = Array.from({ length: 604 }, (_, i) => i + 1).filter((p) => !pageFile(p, tajweed).exists);
  const names = new File(dir(), "sura_names.ttf");
  if (!names.exists) await File.downloadFileAsync(`${CDN}/surah-names/v1/sura_names.ttf`, names, { idempotent: true }).catch(() => undefined);
  let done = 604 - todo.length;
  let failed = 0;
  onProgress(done, 604);
  const worker = async () => {
    while (todo.length && !signal.aborted) {
      const page = todo.shift()!;
      try {
        await File.downloadFileAsync(pageUrl(page, tajweed), pageFile(page, tajweed), { idempotent: true });
        done++;
      } catch {
        failed++;
      }
      onProgress(done, 604);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return failed;
}
