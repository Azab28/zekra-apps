/**
 * Signing in with Google or Facebook from the app, and linking them to the
 * signed-in account: the site's own OAuth (/auth/google, /auth/facebook) in
 * an auth browser session, coming back to zekra://auth with a one-time code
 * the app exchanges for its session token. The code is bound to a PKCE pair
 * (the challenge goes out, the verifier only with the exchange), so a code
 * caught on the way is useless. See SERVER-SPEC.md.
 */
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import type { AppUser } from "./account";
import { SITE_URL, sitePost, type Reply } from "./site";

export type Provider = "google" | "facebook";
export const PROVIDER_NAME: Record<Provider, string> = { google: "جوجل", facebook: "فيسبوك" };
const RETURN = "zekra://auth";

const ERRORS: Record<string, string> = {
  taken: "هذا الحساب مربوط بحساب آخر في ذِكرى.",
  banned: "هذا الحساب موقوف.",
  unavailable: "هذه الطريقة غير متاحة الآن.",
  expired: "انتهت مهلة الدخول، حاول مرة أخرى.",
};
const failed = (code: string | null): Reply<never> => ({ ok: false, status: 400, error: (code && ERRORS[code]) || "تعذّر الدخول، حاول مرة أخرى." });

const base64url = (b64: string) => b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function pkce() {
  const verifier = base64url(btoa(String.fromCharCode(...Crypto.getRandomBytes(32))));
  const challenge = base64url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }));
  return { verifier, challenge };
}

/** Opens the site's sign-in page and waits for zekra://auth; null when the person closed it. */
async function browse(url: string): Promise<URLSearchParams | null> {
  const r = await WebBrowser.openAuthSessionAsync(url, RETURN);
  if (r.type !== "success") return null;
  return new URL(r.url.replace(/^zekra:\/\//, "https://app/")).searchParams;
}

/** Signs in with Google or Facebook: the session token and the account, or why not (null when cancelled). */
export async function oauthLogin(provider: Provider): Promise<Reply<{ token: string; user: AppUser }> | null> {
  const { verifier, challenge } = await pkce();
  const q = await browse(`${SITE_URL}/auth/${provider}?app=${encodeURIComponent(challenge)}`);
  if (!q) return null;
  const code = q.get("code");
  if (!code) return failed(q.get("error"));
  return sitePost<{ token: string; user: AppUser }>("/api/app/auth/exchange", { code, verifier });
}

/** Adds Google or Facebook to the signed-in account (a one-time ticket from /api/app/account/link carries who it is). */
export async function oauthLink(provider: Provider, token: string): Promise<Reply<object> | null> {
  const r = await sitePost<{ url: string }>("/api/app/account/link", { provider }, token);
  if (!r.ok) return r;
  const q = await browse(r.url.startsWith("http") ? r.url : SITE_URL + r.url);
  if (!q) return null;
  return q.get("linked") === provider ? { ok: true } : failed(q.get("error"));
}
