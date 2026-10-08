import path from "node:path";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name} (see .env.example)`);
  return value;
}

export const env = {
  get botToken() {
    return required("TELEGRAM_BOT_TOKEN");
  },
  get sessionSecret() {
    const s = required("SESSION_SECRET");
    if (s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
    return s;
  },
  get databasePath() {
    // Runtime path, not a bundled file: keep Turbopack from tracing the whole project.
    return path.resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH || "data/app.db");
  },
  get dashboardUrl() {
    return (process.env.DASHBOARD_URL || "http://localhost:3000").replace(/\/+$/, "");
  },
  /** Line printed at the bottom of generated images (e.g. "zekra.site"); empty = per channel. */
  get imageFooter() {
    return (process.env.IMAGE_FOOTER || "").trim();
  },
  /** my.telegram.org app for the service account (MTProto); empty = the radio uses RTMP keys only. */
  get tgApiId() {
    return Number(process.env.TG_API_ID || 0);
  },
  get tgApiHash() {
    return (process.env.TG_API_HASH || "").trim();
  },
  /** Telegram user ids with full access to every channel and the admin page. */
  get superAdminIds(): number[] {
    return (process.env.SUPER_ADMIN_IDS || "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isSafeInteger(n) && n > 0);
  },
};

/** Telegram rejects URL buttons that point at localhost, so fall back to plain text there. */
export function isPublicUrl(url: string) {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && !/^(localhost|127\.|\[::1\])/.test(hostname);
  } catch {
    return false;
  }
}
