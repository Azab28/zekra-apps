/**
 * The site's prefs (place, tasbeeh, khatma, settings) on this device or, when
 * signed in, on the account through /api/me, like the website's
 * (src/components/site/site-store.ts) and the same user_prefs row as the bot.
 *
 * Signed in, what's shown is the account's last known state with the changes
 * not sent yet replayed on top (`outbox`, kept on the device), so a change
 * made offline shows at once and goes out when the site is reached again, in
 * order. Tasbeeh taps go in batches with an id (the site counts an id once);
 * a khatma step or the first sign-in's `adopt` that may have arrived before
 * its reply was lost is checked against the account before it's sent again.
 */
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { applyAction, EMPTY_PREFS, type SiteAction, type SitePrefs } from "@lib/site-prefs";
import type { SiteSettings } from "@lib/types";
import { clearToken, deleteRemote, logoutRemote, meCall, readToken, saveToken, type AppUser, type Reply } from "./account";
import { readJson, writeJson } from "./storage";

type Entry = {
  id: string;
  action: SiteAction;
  /** Tried at least once (the site may have it): a tasbeeh batch takes no more taps. */
  sent: boolean;
  /** What the account had before it, to tell whether a lost reply's action arrived (khatma page; tasbeeh total for adopt). */
  base?: number;
};

export type SyncState = {
  ready: boolean;
  prefs: SitePrefs;
  user: AppUser | null;
  /** Changes not on the site yet. */
  pending: number;
  /** The last try didn't reach the site. */
  offline: boolean;
  /** Signed out by the site (session ended, account stopped): the reason, shown once. */
  ended: string | null;
};

const KEYS = { device: "prefs", user: "account", server: "account:prefs", outbox: "account:outbox" };
const TAP_BATCH_MS = 1500;
const SIGNED_OUT = "انتهت جلستك، سجّل الدخول من جديد.";

let ready = false;
let devicePrefs: SitePrefs = EMPTY_PREFS;
let token: string | null = null;
let user: AppUser | null = null;
let server: SitePrefs = EMPTY_PREFS;
let outbox: Entry[] = [];
let offline = false;
let ended: string | null = null;
let failures = 0;

let state: SyncState = { ready, prefs: EMPTY_PREFS, user: null, pending: 0, offline: false, ended: null };
const listeners = new Set<() => void>();

/** The account's state with the unsent changes on top. */
const shown = () => outbox.reduce((p, e) => applyAction(p, e.action) ?? p, server);

function publish() {
  state = { ready, prefs: token ? shown() : devicePrefs, user, pending: outbox.length, offline, ended };
  listeners.forEach((l) => l());
}

const saveOutbox = () => void writeJson(KEYS.outbox, outbox);
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/** Saved prefs, each part checked by replaying it through applyAction. */
function restorePrefs(raw: unknown): SitePrefs {
  if (!raw || typeof raw !== "object") return EMPTY_PREFS;
  return applyAction(EMPTY_PREFS, { type: "adopt", local: raw as SitePrefs }) ?? EMPTY_PREFS;
}

/** The look and reciter the app shares with the account's site settings (set by store.tsx). */
type SettingsBridge = { current: () => SiteSettings; apply: (s: SiteSettings) => void };
let bridge: SettingsBridge | null = null;
export function bridgeSettings(b: SettingsBridge) {
  bridge = b;
}

export async function loadSync() {
  if (ready) return;
  const [device, savedUser, saved, box, tok] = await Promise.all([
    readJson(KEYS.device),
    readJson<AppUser>(KEYS.user),
    readJson<SitePrefs>(KEYS.server),
    readJson<Entry[]>(KEYS.outbox),
    readToken(),
  ]);
  devicePrefs = restorePrefs(device);
  if (tok && savedUser && typeof savedUser.id === "number") {
    token = tok;
    user = savedUser;
    server = saved && typeof saved === "object" ? { ...EMPTY_PREFS, ...saved } : EMPTY_PREFS;
    outbox = Array.isArray(box) ? box.filter((e) => e && typeof e.id === "string" && e.action && typeof e.action.type === "string") : [];
  } else if (tok) {
    void clearToken();
  }
  ready = true;
  publish();
  if (token) void flush(true);
  // Back to the front: send what's waiting, and read what the bot, the site or another phone changed.
  AppState.addEventListener("change", (s) => {
    if (s === "active" && token) void flush(true);
  });
}

export function useSync(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const syncState = () => state;

/** The session token while signed in, for the site's other personal APIs (never logged). */
export const sessionToken = () => token;

/** The `Authorization` header while signed in (rooms, polls: the account instead of this device), else nothing. */
export const authHeader = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

/** Applies a site action here and, signed in, queues it for the account; false when it's refused (invalid). */
export function dispatchAction(action: SiteAction): boolean {
  if (!token) {
    const next = applyAction(devicePrefs, action);
    if (!next) return false;
    devicePrefs = next;
    void writeJson(KEYS.device, next);
    publish();
    return true;
  }
  const before = shown();
  if (!applyAction(before, action)) return false;
  if (action.type === "get") return true;
  const last = outbox.at(-1);
  if (action.type === "tasbeeh" && last && !last.sent && last.action.type === "tasbeeh" && last.action.day === action.day && last.action.add + action.add <= 1000) {
    last.action = { ...last.action, add: last.action.add + action.add };
  } else {
    if (action.type === "settings") outbox = outbox.filter((e) => e.sent || e.action.type !== "settings");
    const id = newId();
    outbox.push({
      id,
      action: action.type === "tasbeeh" ? { ...action, batch: id } : action,
      sent: false,
      base: action.type === "khatma" && action.done ? (before.khatma.page ?? 0) : undefined,
    });
  }
  saveOutbox();
  publish();
  schedule(action.type === "tasbeeh" ? TAP_BATCH_MS : 0);
  return true;
}

/** The app's look and reciter changed: kept in the account's site settings too (its other reading settings as they are). */
export function queueSettings(s: SiteSettings) {
  if (!token) return;
  dispatchAction({ type: "settings", settings: { ...(shown().settings ?? {}), ...s } });
}

let timer: ReturnType<typeof setTimeout> | undefined;
let timerAt = 0;
/** Sends in `ms`, unless a send is already set sooner, or a retry after a failure (offline, taps don't knock every second). */
function schedule(ms: number) {
  const at = Date.now() + ms;
  if (timer && (timerAt <= at || failures > 0)) return;
  clearTimeout(timer);
  timerAt = at;
  timer = setTimeout(() => {
    timer = undefined;
    void flush();
  }, ms);
}

let running: Promise<void> | null = null;
let again = false;
let wantGet = false;

/** Sends what's waiting, one at a time; with `get`, reads the account afterwards if nothing was sent. */
export function flush(get = false): Promise<void> {
  if (get) wantGet = true;
  if (running) {
    again = true;
    return running;
  }
  clearTimeout(timer);
  timer = undefined;
  running = (async () => {
    try {
      do {
        again = false;
        if ((await drain()) !== "ok") break;
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

type Outcome = "ok" | "wait" | "ended";

/** A reply that didn't go through: signed out, or tried again later. */
function settle(r: Extract<Reply<object>, { ok: false }>): Outcome {
  if (r.status === 401 || r.status === 403) {
    void endSession(r.status === 401 ? SIGNED_OUT : "هذا الحساب موقوف.");
    return "ended";
  }
  offline = r.status === 0;
  failures++;
  schedule(r.status === 429 ? (r.retryAfter ?? 60) * 1000 : Math.min(60_000, 3000 * 2 ** (failures - 1)));
  publish();
  return "wait";
}

function took(prefs: SitePrefs) {
  // The same place object while it hasn't changed (screens and the adhan schedule follow it).
  const place = prefs.place && server.place && JSON.stringify(prefs.place) === JSON.stringify(server.place) ? server.place : prefs.place;
  server = { ...EMPTY_PREFS, ...prefs, place };
  void writeJson(KEYS.server, server);
  offline = false;
  failures = 0;
}

/** Whether an action sent before (reply lost) is already in the account's state. */
function arrived(e: Entry, s: SitePrefs): boolean {
  if (e.action.type === "khatma" && e.action.done) return s.khatma.page !== e.base;
  if (e.action.type === "adopt" && e.base !== undefined) return s.tasbeeh.total >= e.base + (e.action.local.tasbeeh?.total ?? 0);
  return false;
}
const needsCheck = (e: Entry) => e.base !== undefined && ((e.action.type === "khatma" && !!e.action.done) || e.action.type === "adopt");

async function drain(): Promise<Outcome> {
  const t = token;
  if (!t) return "ended";
  let replied = false;
  while (outbox.length) {
    const e = outbox[0];
    if (e.sent && needsCheck(e)) {
      const r = await meCall(t, { type: "get" });
      if (token !== t) return "ended";
      if (!r.ok) return settle(r);
      took(r.prefs);
      if (arrived(e, server)) {
        outbox = outbox.filter((x) => x !== e);
        saveOutbox();
        publish();
        continue;
      }
    }
    if (!e.sent) {
      e.sent = true;
      saveOutbox();
    }
    const r = await meCall(t, e.action);
    if (token !== t) return "ended";
    if (r.ok) {
      took(r.prefs);
      replied = true;
    } else if (r.status !== 400) {
      return settle(r);
    }
    // Done, or refused as invalid (sending it again wouldn't help).
    outbox = outbox.filter((x) => x !== e);
    saveOutbox();
    publish();
  }
  if (wantGet && !replied) {
    wantGet = false;
    const r = await meCall(t, { type: "get" });
    if (token !== t) return "ended";
    if (!r.ok) return settle(r);
    took(r.prefs);
  }
  wantGet = false;
  reconcileSettings();
  publish();
  return "ok";
}

/** Nothing waiting: the account's look and reciter here, or (none saved yet) this phone's sent to it. */
function reconcileSettings() {
  if (!bridge || outbox.length) return;
  if (!server.settings) return queueSettings(bridge.current());
  bridge.apply(server.settings);
}

/**
 * Signed in (null, or why the session couldn't be kept): the device's own city, khatma and tasbeeh counts go to the
 * account once (the account's own city and khatma win), then the device
 * keeps only its city, so another account doesn't get the counts too.
 */
export async function signIn(newToken: string, u: AppUser): Promise<string | null> {
  const local = devicePrefs;
  await writeJson(KEYS.user, u);
  try {
    await saveToken(newToken);
  } catch {
    return "تعذّر حفظ تسجيل الدخول على هذا الجهاز.";
  }
  token = newToken;
  user = u;
  server = EMPTY_PREFS;
  outbox = [];
  ended = null;
  offline = false;
  failures = 0;
  const r = await meCall(newToken, { type: "get" });
  if (token !== newToken) return null;
  if (r.ok) took(r.prefs);
  if ((local.place && !server.place) || local.khatma.page || local.tasbeeh.total > 0) {
    outbox.push({ id: newId(), action: { type: "adopt", local: { place: local.place, tasbeeh: local.tasbeeh, khatma: local.khatma } }, sent: false, base: r.ok ? server.tasbeeh.total : undefined });
  }
  devicePrefs = { ...EMPTY_PREFS, place: local.place };
  void writeJson(KEYS.device, devicePrefs);
  saveOutbox();
  publish();
  void flush();
  return null;
}

/** Back to the device alone: it keeps the account's city (prayer times and the adhan go on); the rest stays in the account. */
async function signOutHere(reason: string | null) {
  const place = shown().place ?? devicePrefs.place;
  token = null;
  user = null;
  server = EMPTY_PREFS;
  outbox = [];
  offline = false;
  failures = 0;
  ended = reason;
  clearTimeout(timer);
  devicePrefs = { ...devicePrefs, place };
  publish();
  await clearToken();
  await Promise.all([writeJson(KEYS.device, devicePrefs), writeJson(KEYS.user, null), writeJson(KEYS.server, null), writeJson(KEYS.outbox, [])]);
}

const endSession = (reason: string) => signOutHere(reason);

/** Another personal API refused the session (401: ended, 403: banned): signed out here, as when /api/me refuses it. */
export function sessionRefused(status: number) {
  if (token && (status === 401 || status === 403)) void endSession(status === 401 ? SIGNED_OUT : "هذا الحساب موقوف.");
}

export const clearEnded = () => {
  ended = null;
  publish();
};

/** «تسجيل الخروج»: what's waiting is sent first if it can be, then the session ends on the site too. */
export async function signOut() {
  const t = token;
  if (!t) return;
  if (outbox.length) await flush();
  await logoutRemote(t);
  await signOutHere(null);
}

/** «حذف الحساب» (the stores require it in the app): `confirm` must be «حذف». */
export async function deleteAccount(confirm: string): Promise<Reply<object>> {
  const t = token;
  if (!t) return { ok: false, status: 401, error: SIGNED_OUT };
  const r = await deleteRemote(t, confirm);
  if (r.ok || r.status === 401) await signOutHere(null);
  return r;
}

/** The account moved into another (a web-only account that added Telegram): the new session, keeping what's waiting. */
export async function replaceSession(newToken: string, u: AppUser) {
  await saveToken(newToken);
  await writeJson(KEYS.user, u);
  token = newToken;
  user = u;
  publish();
  void flush(true);
}
