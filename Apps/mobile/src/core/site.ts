/** The website the app reads from and posts to (its public API only). */
export const SITE_URL = "https://zekra.site";

/** GET a JSON endpoint of the site, given up after `ms`. */
export async function siteJson<T>(path: string, ms = 8000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(SITE_URL + path, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** A reply: the body when it went through, else the status (0 = the site wasn't reached) and a message in Arabic for the person. */
export type Reply<T> =
  | ({ ok: true } & T)
  | { ok: false; status: number; error: string; unverified?: boolean; retryAfter?: number };

export const OFFLINE = "تعذّر الاتصال بالموقع. تأكّد من الإنترنت وحاول مرة أخرى.";
const FAILED = "حدث خطأ، حاول بعد قليل.";
/** The site's messages are Arabic and shown as they are; its English codes (/api/me) aren't. */
const arabic = (s: unknown): s is string => typeof s === "string" && /[\u0600-\u06FF]/.test(s);

export async function sitePost<T>(path: string, body: unknown, token?: string | null, ms = 15_000): Promise<Reply<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  let res: Response;
  try {
    res = await fetch(SITE_URL + path, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    clearTimeout(timer);
    return { ok: false, status: 0, error: OFFLINE };
  }
  clearTimeout(timer);
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.ok && json?.ok !== false) return { ok: true, ...(json as T) };
  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after"));
    // The per-IP limit puts its Arabic in `message`; the app routes' own limits in `error`.
    const text = arabic(json?.message) ? json.message : arabic(json?.error) ? json.error : FAILED;
    return { ok: false, status: 429, error: text, retryAfter: retry > 0 ? retry : 60 };
  }
  return { ok: false, status: res.status, error: arabic(json?.error) ? json.error : FAILED, unverified: json?.unverified === true };
}
