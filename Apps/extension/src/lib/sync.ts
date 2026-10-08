/**
 * The user's data away from this device.
 *
 * 1. A copy in their Chrome (or Edge) account: chrome.storage.sync, which the
 *    browser carries to every computer signed in to that account with sync on
 *    (its «Extensions» item). The settings, to-dos and notes are gzipped and
 *    split into 7 KB items (~100 KB in all). A copy made on another computer is
 *    merged in on start: notes by their last edit, to-do lists by id.
 * 2. A file to save and load, of the parts the user picks.
 *
 * (A Drive folder or rclone would need a server or a Google sign-in of our
 * own; the browser's account sync needs neither.)
 */
import { cleanLists, cleanNotes, NOTES_KEY, TODO_KEY, type Note, type TodoList } from "./data";

export type Part = "settings" | "shortcuts" | "todos" | "notes";
export const PARTS: [Part, string][] = [
  ["settings", "الإعدادات"],
  ["shortcuts", "الاختصارات"],
  ["todos", "المهام"],
  ["notes", "الملاحظات"],
];

const SYNC_KEYS = ["settings", TODO_KEY, NOTES_KEY] as const;
const META = "backup.meta";
const PART = (i: number) => `backup.${i}`;
/** Characters per sync item (under the 8192-byte item limit with its key). */
const CHUNK = 7000;
/** chrome.storage.sync holds 102,400 bytes; leave room for the meta item. */
const MAX_CHARS = 95_000;

export type Backup = { at: number; device?: string; data: Record<string, unknown> };
export type BackupMeta = { at: number; parts: number; size: number; device?: string };

/** This browser profile's id (a copy it made itself isn't merged back). */
export async function deviceId(): Promise<string> {
  const got = (await chrome.storage.local.get("device.id"))["device.id"] as string | undefined;
  if (got) return got;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ "device.id": id });
  return id;
}

// ---------- the parts ----------

type Raw = Record<string, unknown> & { settings?: Record<string, unknown> };

/** The chosen parts as stored keys (the shortcuts are the settings' `dock` with their pictures). */
export async function collectParts(parts: Part[]): Promise<Backup> {
  const local = (await chrome.storage.local.get(["settings", TODO_KEY, NOTES_KEY, "dock.icons"])) as Raw;
  const data: Record<string, unknown> = {};
  const settings = { ...(local.settings ?? {}) };
  if (parts.includes("settings")) {
    const { dock: _dock, ...rest } = settings;
    void _dock;
    data.settings = rest;
  }
  if (parts.includes("shortcuts")) {
    data.shortcuts = settings.dock ?? null;
    data["dock.icons"] = local["dock.icons"] ?? {};
  }
  if (parts.includes("todos")) data[TODO_KEY] = local[TODO_KEY] ?? [];
  if (parts.includes("notes")) data[NOTES_KEY] = local[NOTES_KEY] ?? [];
  return { at: Date.now(), device: await deviceId(), data };
}

/** Which parts a backup carries. */
export function partsOf(b: Backup): Part[] {
  const d = b.data ?? {};
  // A whole-settings copy (the account's) also carries the shortcuts.
  const settings = d.settings as { dock?: unknown } | undefined;
  return PARTS.map(([p]) => p).filter((p) =>
    p === "settings" ? !!settings : p === "shortcuts" ? "shortcuts" in d || !!settings?.dock : p === "todos" ? TODO_KEY in d : NOTES_KEY in d,
  );
}

/** Notes: one list with each note's latest edit. */
function mergeNotes(mine: Note[], theirs: Note[]): Note[] {
  const byId = new Map(mine.map((n) => [n.id, n]));
  for (const n of theirs) {
    const m = byId.get(n.id);
    if (!m || n.updated > m.updated) byId.set(n.id, n);
  }
  return [...byId.values()];
}

/** To-dos: lists by id, tasks by id (theirs win for the same task: it's the newer copy). */
function mergeTodos(mine: TodoList[], theirs: TodoList[]): TodoList[] {
  const out = mine.map((l) => ({ ...l, todos: [...l.todos] }));
  for (const t of theirs) {
    const m = out.find((l) => l.id === t.id);
    if (!m) {
      out.push(t);
      continue;
    }
    for (const task of t.todos) {
      const i = m.todos.findIndex((x) => x.id === task.id);
      if (i >= 0) m.todos[i] = task;
      else m.todos.push(task);
    }
  }
  return out;
}

/** Puts the chosen parts of a backup on this device: merged (to-dos, notes) or replacing them. */
export async function applyParts(b: Backup, parts: Part[], mode: "merge" | "replace") {
  const d = (b.data ?? {}) as Raw;
  const local = (await chrome.storage.local.get(["settings", TODO_KEY, NOTES_KEY, "dock.icons"])) as Raw;
  const out: Record<string, unknown> = {};
  let settings = { ...(local.settings ?? {}) };
  if (parts.includes("settings") && d.settings) {
    const { dock, ...rest } = d.settings;
    settings = { ...settings, ...rest };
    // An account copy carries the dock inside the settings.
    if (dock && !("shortcuts" in d) && parts.includes("shortcuts")) settings.dock = dock;
  }
  if (parts.includes("shortcuts") && d.shortcuts) {
    settings.dock = d.shortcuts;
    out["dock.icons"] = { ...((local["dock.icons"] as object) ?? {}), ...((d["dock.icons"] as object) ?? {}) };
  }
  if (parts.includes("settings") || parts.includes("shortcuts")) out.settings = settings;
  // Only well-formed lists and notes are taken in (a file or another copy can hold anything).
  if (parts.includes("todos") && Array.isArray(d[TODO_KEY])) {
    const theirs = cleanLists(d[TODO_KEY]);
    out[TODO_KEY] = mode === "merge" ? mergeTodos(cleanLists(local[TODO_KEY]), theirs) : theirs;
  }
  if (parts.includes("notes") && Array.isArray(d[NOTES_KEY])) {
    const theirs = cleanNotes(d[NOTES_KEY]);
    out[NOTES_KEY] = mode === "merge" ? mergeNotes(cleanNotes(local[NOTES_KEY]), theirs) : theirs;
  }
  await chrome.storage.local.set(out);
}

// ---------- the account copy ----------

async function gzip(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function gunzip(b64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

/** Writes this device's data to the account. Throws "too-big" past sync's room. */
export async function push(): Promise<BackupMeta> {
  const data = await chrome.storage.local.get([...SYNC_KEYS]);
  const b: Backup = { at: Date.now(), device: await deviceId(), data };
  const packed = await gzip(JSON.stringify(b));
  if (packed.length > MAX_CHARS) throw new Error("too-big");
  const parts = Math.ceil(packed.length / CHUNK);
  const items: Record<string, unknown> = {};
  for (let i = 0; i < parts; i++) items[PART(i)] = packed.slice(i * CHUNK, (i + 1) * CHUNK);
  const meta: BackupMeta = { at: b.at, parts, size: packed.length, device: b.device };
  const old = await remoteMeta();
  await chrome.storage.sync.set({ ...items, [META]: meta });
  if (old && old.parts > parts) await chrome.storage.sync.remove(Array.from({ length: old.parts - parts }, (_, k) => PART(parts + k)));
  await chrome.storage.local.set({ "backup.pushed": b.at });
  return meta;
}

export async function remoteMeta(): Promise<BackupMeta | null> {
  return ((await chrome.storage.sync.get(META))[META] as BackupMeta | undefined) ?? null;
}

async function readRemote(): Promise<Backup | null> {
  const meta = await remoteMeta();
  if (!meta) return null;
  const got = await chrome.storage.sync.get(Array.from({ length: meta.parts }, (_, i) => PART(i)));
  const packed = Array.from({ length: meta.parts }, (_, i) => String(got[PART(i)] ?? "")).join("");
  return JSON.parse(await gunzip(packed)) as Backup;
}

/** The account's copy onto this device: merged (default) or replacing it. */
export async function pull(mode: "merge" | "replace" = "merge"): Promise<Backup | null> {
  const b = await readRemote();
  if (!b) return null;
  await applyParts(b, ["settings", "shortcuts", "todos", "notes"], mode);
  await chrome.storage.local.set({ "backup.pushed": b.at });
  return b;
}

/** On start: a newer copy from another computer is merged in. True when something came in. */
export async function pullIfNewer(): Promise<boolean> {
  const [meta, pushed, me] = await Promise.all([remoteMeta(), chrome.storage.local.get("backup.pushed"), deviceId()]);
  if (!meta || meta.device === me || meta.at <= (Number(pushed["backup.pushed"]) || 0)) return false;
  await pull("merge");
  return true;
}

/** True for the local keys the account copy carries (a change to one is worth a new copy). */
export const isSynced = (key: string) => (SYNC_KEYS as readonly string[]).includes(key);
