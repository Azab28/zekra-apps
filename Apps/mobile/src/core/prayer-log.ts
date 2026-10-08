/**
 * The personal prayer log, as the site's /salat: «في وقتها» or «بعد الوقت» for
 * each prayer of a day. On this device (the last few months); signed in, the
 * account's log through /api/prayer-log (the same as the bot's /salat) when
 * the site accepts the app's session there, else still on the device.
 */
import { useCallback, useEffect, useState } from "react";
import { readJson, writeJson } from "./storage";
import { sitePost } from "./site";
import { sessionToken, useSync } from "./sync";

export const LOG_PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type LogPrayer = (typeof LOG_PRAYERS)[number];
export type LogStatus = "ontime" | "late";
export type Marks = Record<string, Partial<Record<LogPrayer, LogStatus>>>;

const KEY = "prayer-log";

/** Tap cycle: none → on time → late → none (src/lib/prayer-log.ts nextStatus). */
export const nextStatus = (s: LogStatus | undefined): LogStatus | null => (!s ? "ontime" : s === "ontime" ? "late" : null);
export const completeDay = (m: Marks, day: string) => LOG_PRAYERS.every((p) => m[day]?.[p]);

async function readLocal(): Promise<Marks> {
  const m = await readJson<Marks>(KEY);
  return m && typeof m === "object" ? m : {};
}
/** Only the last few months stay on the device. */
const writeLocal = (m: Marks) => writeJson(KEY, Object.fromEntries(Object.entries(m).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 120)));

async function remote(body: object): Promise<Marks | null> {
  const token = sessionToken();
  if (!token) return null;
  const r = await sitePost<{ marks: Marks }>("/api/prayer-log", body, token);
  return r.ok ? r.marks : null;
}

export function usePrayerLog(from: string, to: string) {
  const { user } = useSync();
  const [marks, setMarks] = useState<Marks | null>(null);
  const [synced, setSynced] = useState(false);

  const load = useCallback(async () => {
    const fromAccount = user ? await remote({ from, to }) : null;
    setSynced(!!fromAccount);
    setMarks(fromAccount ?? (await readLocal()));
  }, [user, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (day: string, prayer: LogPrayer) => {
    if (!marks) return;
    const status = nextStatus(marks[day]?.[prayer]);
    const dayMarks = { ...marks[day] };
    if (status) dayMarks[prayer] = status;
    else delete dayMarks[prayer];
    const updated = { ...marks, [day]: dayMarks };
    setMarks(updated);
    if (synced) {
      const fresh = await remote({ from, to, mark: { day, prayer, status } });
      if (fresh) setMarks(fresh);
    } else await writeLocal(updated);
  };

  return { marks, synced, toggle, reload: load };
}
