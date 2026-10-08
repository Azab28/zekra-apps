/**
 * The site's account API for the app (src/app/api/app/auth/* and /api/me):
 * JSON in and out, the session as a token sent back as `Authorization:
 * Bearer`. The token lives only in the device's secure storage
 * (expo-secure-store) and is never logged or shown.
 */
import * as SecureStore from "expo-secure-store";
import type { SiteAction, SitePrefs } from "@lib/site-prefs";
import { sitePost as post, type Reply } from "./site";

export { OFFLINE, type Reply } from "./site";

export type AppUser = { id: number; name: string | null; username: string | null; telegram: boolean };

const TOKEN_KEY = "zekra.session";

export const readToken = () => SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
export const saveToken = (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);

type Session = { token: string; user: AppUser };

export const passwordLogin = (identifier: string, password: string) => post<Session>("/api/app/auth/password", { identifier, password });

export type SignUp = { firstName: string; lastName: string; username: string; email: string; password: string; confirm: string };
export const signUp = (input: SignUp) => post<{ email: string }>("/api/app/auth/signup", input);

/** Sign-in with Telegram: open `link`, then poll with `login` and `nonce` (the nonce never leaves the app otherwise). */
export async function telegramStart(): Promise<Reply<{ login: string; nonce: string; link: string }>> {
  const r = await post<{ token: string; nonce: string; link: string }>("/api/app/auth/telegram", {});
  return r.ok ? { ok: true, login: r.token, nonce: r.nonce, link: r.link } : r;
}

export type TelegramPoll = { status: "pending" | "invalid" } | ({ status: "ok" } & Session);
export const telegramPoll = (login: string, nonce: string) => post<TelegramPoll>("/api/app/auth/telegram/poll", { token: login, nonce }, null, 10_000);

export const logoutRemote = (token: string) => post<object>("/api/app/auth/logout", {}, token, 6_000);
export const deleteRemote = (token: string, confirm: string) => post<object>("/api/app/auth/delete", { confirm }, token);

/** One of the site's actions on the account (src/lib/site-prefs.ts); the reply is the account's state after it. */
export const meCall = (token: string, action: SiteAction) => post<{ prefs: SitePrefs; name?: string }>("/api/me", { action }, token);

/** The account's name as shown: the name, else @username. */
export const userLabel = (u: AppUser) => u.name || (u.username ? `@${u.username}` : "حسابك");

// ---------- the account's sign-in methods (SERVER-SPEC.md) ----------

export type Identities = {
  user: AppUser;
  telegram: boolean;
  google: boolean;
  facebook: boolean;
  /** The confirmed email (sign-in by email link or password), if any. */
  email: string | null;
  username: string | null;
  hasPassword: boolean;
};

export const accountInfo = (token: string) => post<Identities>("/api/app/account", {}, token);

/**
 * A password for the account: changing it needs the current one; a first one
 * (a Telegram or Google account) needs a username and an email, confirmed by
 * a link before it works (`pending`).
 */
export const setPassword = (token: string, body: { current?: string; password: string; confirm: string; username?: string; email?: string }) =>
  post<{ pending?: boolean; email?: string }>("/api/app/account/password", body, token);

/** A web-only account adds Telegram: the bot asks «نعم، أنا», the account moves into the Telegram one, so a new session comes back. */
export async function linkTelegramStart(token: string): Promise<Reply<{ login: string; nonce: string; link: string }>> {
  const r = await post<{ token: string; nonce: string; link: string }>("/api/app/account/telegram", {}, token);
  return r.ok ? { ok: true, login: r.token, nonce: r.nonce, link: r.link } : r;
}
export const linkTelegramPoll = (token: string, login: string, nonce: string) =>
  post<{ status: "pending" | "invalid" } | { status: "ok"; token: string; user: AppUser }>("/api/app/account/telegram/poll", { token: login, nonce }, token, 10_000);
