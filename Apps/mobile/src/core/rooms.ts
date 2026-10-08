/**
 * Shared khatmas and «صدقة جارية» pages (the site's /k/<slug>, /api/khatma-room)
 * from the app: as this device (a random id kept on it) with the name the
 * person gave, like a browser that isn't signed in (signed in, the session
 * goes too, so the site can count it as the account's). Memorial counters go
 * through src/lib/room-sync.ts unchanged, so taps count once and numbers never
 * go back.
 */
import type { MyRoom, RoomView } from "@lib/khatma-room";
import { readJson, writeJson } from "./storage";
import { SITE_URL } from "./site";
import { authHeader } from "./sync";

export type RoomReply = { ok: boolean; view?: RoomView; error?: string; takerName?: string; finishedRound?: number | null; slug?: string; rooms?: MyRoom[]; message?: string };

let device: string | null = null;
let name = "";

/** This phone's id for the rooms (made once). */
export async function deviceId(): Promise<string> {
  if (device) return device;
  const saved = await readJson<string>("room:device");
  if (typeof saved === "string" && /^[\w-]{16,64}$/.test(saved)) return (device = saved);
  device = Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
  await writeJson("room:device", device);
  return device;
}

/** The name shown next to a juz this phone takes. */
export async function savedName(): Promise<string> {
  if (!name) name = (await readJson<string>("room:name")) ?? "";
  return name;
}
export async function saveName(v: string) {
  name = v.trim();
  await writeJson("room:name", name);
}

/** One call to /api/khatma-room; null when the site wasn't reached. */
export async function roomCall(body: Record<string, unknown>): Promise<RoomReply | null> {
  try {
    const res = await fetch(`${SITE_URL}/api/khatma-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeader() },
      body: JSON.stringify({ ...body, device: await deviceId(), name: await savedName() }),
    });
    const json = (await res.json()) as RoomReply;
    // A refusal from the per-IP limit has its Arabic text in `message`.
    return res.status === 429 ? { ok: false, error: "rate_limited", message: json.message } : json;
  } catch {
    return null;
  }
}

/** A shared link or a bare slug: «https://zekra.site/k/abc123» → «abc123». */
export function slugFrom(input: string): string | null {
  const m = /(?:\/k\/)?([\w-]{4,40})\/?$/.exec(input.trim());
  return m ? m[1] : null;
}

export const roomUrl = (slug: string) => `${SITE_URL}/k/${slug}`;

/**
 * The juz someone is reading for a shared khatma («اقرأ» on its page), as the
 * site's GroupReading: the mushaf shows it and marks it done from there. One
 * at a time, on the phone.
 */
export type GroupReading = { slug: string; juz: number; heading: string; from: number; to: number };
const READING_KEY = "room:reading";

export async function groupReading(): Promise<GroupReading | null> {
  const r = await readJson<GroupReading>(READING_KEY);
  return r && typeof r.slug === "string" && Number.isInteger(r.juz) && r.from >= 1 && r.to >= r.from ? r : null;
}
export const setGroupReading = (r: GroupReading | null) => writeJson(READING_KEY, r);
