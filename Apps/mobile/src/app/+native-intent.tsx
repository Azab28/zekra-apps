/**
 * Links from outside: https://zekra.site/... (App Links, app.json intentFilters,
 * once the site serves /.well-known/assetlinks.json) and zekra://... land
 * here first. The site's paths that the app has its own screen for go there
 * (/r/<slug> is the app's /azkar/<slug>; /surah/<n>/tafsir/… the surah);
 * zekra://auth is the sign-in browser's answer, read by core/oauth.ts, so
 * it moves nothing; anything else opens the home tab.
 */
const SAME = /^\/(k|mushaf|surah|sunnah|recitations|radio|prayer|hijri|qibla|tasbeeh|khatma|asma|ali|ramadan|salat|dua-poster|quran-duas|recap|feedback|account|search|pdf|listen|reminders)(\/|$)/;

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  try {
    const url = new URL(path, "zekra://app");
    // zekra://auth?… parses with "auth" as the host.
    if (url.protocol === "zekra:" && (url.host === "auth" || url.pathname.replace(/^\/+/, "") === "auth")) return null;
    const p = (url.protocol === "zekra:" && url.host && url.host !== "app" ? `/${url.host}${url.pathname}` : url.pathname).replace(/\/+$/, "") || "/";
    const reader = /^\/r\/([\w-]{1,60})$/.exec(p);
    if (reader) return `/azkar/${reader[1]}`;
    const tafsir = /^\/surah\/(\d{1,3})\/tafsir/.exec(p);
    if (tafsir) return `/surah/${tafsir[1]}`;
    if (p === "/k/aliazab") return "/ali";
    if (SAME.test(p)) return p + url.search;
    return "/";
  } catch {
    return "/";
  }
}
