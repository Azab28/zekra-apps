/**
 * Recitations kept on the device for listening offline: a surah of a
 * recitation (mp3quran.net) saved as documents/recitations/<moshaf>/<NNN>.mp3,
 * one download at a time (a queue), written to a .part file first so a cut
 * download never counts. The player plays a saved surah from the file.
 */
import { Directory, File, Paths } from "expo-file-system";
import { useSyncExternalStore } from "react";
import { readJson, writeJson } from "./storage";

export type MoshafInfo = { reciter: string; reciterId: number; moshaf: string; moshafId: number; server: string; surahs: number[] };
/** What's saved for one recitation: its details, and the surahs on the device. */
type Saved = MoshafInfo & { saved: number[] };

type Job = { info: MoshafInfo; surah: number };
export type SurahState = { kind: "none" } | { kind: "queued" } | { kind: "loading"; progress: number } | { kind: "done" } | { kind: "error" };

const pad = (n: number) => String(n).padStart(3, "0");
const key = (moshafId: number, surah: number) => `${moshafId}:${surah}`;
const INDEX = "downloads";

let index: Record<string, Saved> = {};
let loaded = false;
const queue: Job[] = [];
let current: { job: Job; progress: number; abort: AbortController } | null = null;
const failed = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();

const changed = () => {
  version++;
  listeners.forEach((l) => l());
};
const persist = () => void writeJson(INDEX, index);

const moshafDir = (moshafId: number) => new Directory(Paths.document, "recitations", String(moshafId));
const surahFile = (moshafId: number, surah: number) => new File(moshafDir(moshafId), `${pad(surah)}.mp3`);

async function load() {
  if (loaded) return;
  loaded = true;
  const saved = await readJson<Record<string, Saved>>(INDEX);
  if (saved && typeof saved === "object") index = saved;
  changed();
}
void load();

/** The saved file of a surah, to play offline; null when it isn't on the device. */
export function localSurahUri(moshafId: number, surah: number): string | null {
  if (!index[moshafId]?.saved.includes(surah)) return null;
  const f = surahFile(moshafId, surah);
  return f.exists ? f.uri : null;
}

export function surahState(moshafId: number, surah: number): SurahState {
  const k = key(moshafId, surah);
  if (current && key(current.job.info.moshafId, current.job.surah) === k) return { kind: "loading", progress: current.progress };
  if (queue.some((j) => key(j.info.moshafId, j.surah) === k)) return { kind: "queued" };
  if (index[moshafId]?.saved.includes(surah)) return { kind: "done" };
  return failed.has(k) ? { kind: "error" } : { kind: "none" };
}

/** Re-renders on any change to the downloads. */
export function useDownloads(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
}

/** Queues these surahs of a recitation (those already saved or queued are skipped). */
export function queueDownloads(info: MoshafInfo, surahs: number[]) {
  for (const surah of surahs) {
    const s = surahState(info.moshafId, surah).kind;
    if (s === "done" || s === "queued" || s === "loading") continue;
    failed.delete(key(info.moshafId, surah));
    queue.push({ info, surah });
  }
  changed();
  void run();
}

async function run() {
  if (current) return;
  await load();
  const job = queue.shift();
  if (!job) return changed();
  const { info, surah } = job;
  const abort = new AbortController();
  current = { job, progress: 0, abort };
  changed();
  const dir = moshafDir(info.moshafId);
  const part = new File(dir, `${pad(surah)}.mp3.part`);
  try {
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    let last = 0;
    await File.downloadFileAsync(`${info.server}${pad(surah)}.mp3`, part, {
      idempotent: true,
      signal: abort.signal,
      onProgress: ({ bytesWritten, totalBytes }) => {
        if (!current || totalBytes <= 0) return;
        current.progress = bytesWritten / totalBytes;
        // A repaint every few percent is enough.
        if (current.progress - last >= 0.03) {
          last = current.progress;
          changed();
        }
      },
    });
    const target = surahFile(info.moshafId, surah);
    if (target.exists) target.delete();
    part.moveSync(target);
    const entry = index[info.moshafId] ?? { ...info, saved: [] };
    index[info.moshafId] = { ...info, saved: [...new Set([...entry.saved, surah])].sort((a, b) => a - b) };
    persist();
  } catch {
    if (part.exists) part.delete();
    if (!abort.signal.aborted) failed.add(key(info.moshafId, surah));
  } finally {
    current = null;
    changed();
    void run();
  }
}

/** Stops a queued or running download of a surah. */
export function cancelDownload(moshafId: number, surah: number) {
  const k = key(moshafId, surah);
  const i = queue.findIndex((j) => key(j.info.moshafId, j.surah) === k);
  if (i >= 0) queue.splice(i, 1);
  if (current && key(current.job.info.moshafId, current.job.surah) === k) current.abort.abort();
  changed();
}

/** Stops everything queued for a recitation, and its running download. */
export function cancelMoshaf(moshafId: number) {
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].info.moshafId === moshafId) queue.splice(i, 1);
  if (current?.job.info.moshafId === moshafId) current.abort.abort();
  changed();
}

export function removeSurah(moshafId: number, surah: number) {
  const f = surahFile(moshafId, surah);
  if (f.exists) f.delete();
  const entry = index[moshafId];
  if (entry) {
    entry.saved = entry.saved.filter((s) => s !== surah);
    if (!entry.saved.length) delete index[moshafId];
    persist();
  }
  changed();
}

export function removeMoshaf(moshafId: number) {
  cancelMoshaf(moshafId);
  const dir = moshafDir(moshafId);
  if (dir.exists) dir.delete();
  delete index[moshafId];
  persist();
  changed();
}

/** Every recitation with saved surahs, and the space they take (bytes). */
export function savedRecitations(): (Saved & { bytes: number })[] {
  return Object.values(index)
    .filter((s) => s.saved.length > 0)
    .map((s) => ({ ...s, bytes: s.saved.reduce((sum, surah) => sum + (surahFile(s.moshafId, surah).size ?? 0), 0) }))
    .sort((a, b) => a.reciter.localeCompare(b.reciter, "ar"));
}

export const savedCount = (moshafId: number) => index[moshafId]?.saved.length ?? 0;

/** «١٢٫٥ ميجا» */
export function sizeLabel(bytes: number, digits: (n: string) => string): string {
  const fixed = bytes >= 1024 ** 3 ? (bytes / 1024 ** 3).toFixed(1) : (bytes / 1024 ** 2).toFixed(bytes >= 100 * 1024 ** 2 ? 0 : 1);
  return `${digits(fixed).replace(".", "٫")} ${bytes >= 1024 ** 3 ? "جيجا" : "ميجا"}`;
}
