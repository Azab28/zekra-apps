/**
 * The app's state: the same prefs as the website's (src/lib/site-prefs.ts —
 * place, tasbeeh, khatma — changed only through its `applyAction`, so the
 * rules match the site and the bot), on the device or, signed in, on the
 * account (sync.ts); the app's own settings (the colour, reciter and reading
 * looks also kept in a signed-in account); and the Hijri offset read from the site.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { AYAH_RECITERS } from "@lib/ayah-audio";
import { isImageStyle } from "@lib/image-styles";
import { isPalette } from "@lib/palettes";
import type { SiteAction, SitePrefs } from "@lib/site-prefs";
import type { SiteSettings } from "@lib/types";
import type { AppUser } from "./account";
import { fetchHijriOffset, savedHijriOffset } from "./hijri-offset";
import { DEFAULT_SETTINGS, normalizeSettings, type AppSettings } from "./settings";
import { readJson, writeJson } from "./storage";
import { bridgeSettings, dispatchAction, loadSync, queueSettings, useSync } from "./sync";

type Store = {
  ready: boolean;
  prefs: SitePrefs;
  /** The signed-in account (null: everything stays on this device). */
  user: AppUser | null;
  settings: AppSettings;
  hijriOffset: number;
  /** Applies a site action; false when it was refused (invalid). */
  dispatch: (action: SiteAction) => boolean;
  updateSettings: (change: (s: AppSettings) => AppSettings) => void;
};

const StoreContext = createContext<Store | null>(null);

/** The app settings an account keeps with the site's reading settings (`user_prefs.site_settings`). */
const sharedOf = (s: AppSettings): SiteSettings => ({ palette: s.palette, reciter: s.reciter, pageStyle: s.pageStyle, imageStyle: s.imageStyle, large: s.large, tajweed: s.tajweed, hadithPlain: s.hadithPlain });

/** The account's site settings over the app's (only valid values; the site's old `night` is the «ليلي» page). */
function withShared(cur: AppSettings, site: SiteSettings): AppSettings {
  return {
    ...cur,
    palette: isPalette(site.palette) ? site.palette : cur.palette,
    reciter: AYAH_RECITERS.some((r) => r.id === site.reciter) ? site.reciter! : cur.reciter,
    pageStyle: isImageStyle(site.pageStyle) ? site.pageStyle : site.night ? "night" : cur.pageStyle,
    imageStyle: isImageStyle(site.imageStyle) ? site.imageStyle : cur.imageStyle,
    large: typeof site.large === "boolean" ? site.large : cur.large,
    tajweed: typeof site.tajweed === "boolean" ? site.tajweed : cur.tajweed,
    hadithPlain: typeof site.hadithPlain === "boolean" ? site.hadithPlain : cur.hadithPlain,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const sync = useSync();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  const [hijriOffset, setHijriOffset] = useState(0);

  const saveSettings = useCallback((next: AppSettings) => {
    settingsRef.current = next;
    setSettings(next);
    void writeJson("settings", next);
  }, []);

  useEffect(() => {
    let alive = true;
    // The account's colour, reciter and reading looks (the site's settings) and the app's, kept the same.
    bridgeSettings({
      current: () => sharedOf(settingsRef.current),
      apply: (site) => {
        const cur = settingsRef.current;
        const next = withShared(cur, site);
        if (JSON.stringify(sharedOf(next)) !== JSON.stringify(sharedOf(cur))) saveSettings(next);
      },
    });
    void (async () => {
      const [s, offset] = await Promise.all([readJson("settings"), savedHijriOffset()]);
      if (!alive) return;
      settingsRef.current = normalizeSettings(s);
      setSettings(settingsRef.current);
      setHijriOffset(offset);
      setLoaded(true);
      await loadSync();
    })();
    return () => {
      alive = false;
    };
  }, []);

  // The site's offset on opening the app and whenever it comes back to the front.
  useEffect(() => {
    const refresh = () =>
      void fetchHijriOffset().then((v) => {
        if (v !== null) setHijriOffset(v);
      });
    refresh();
    const sub = AppState.addEventListener("change", (s) => s === "active" && refresh());
    return () => sub.remove();
  }, []);

  const dispatch = useCallback((action: SiteAction) => dispatchAction(action), []);

  const updateSettings = useCallback(
    (change: (s: AppSettings) => AppSettings) => {
      const cur = settingsRef.current;
      const next = normalizeSettings(change(cur));
      saveSettings(next);
      const shared = sharedOf(next);
      if (JSON.stringify(shared) !== JSON.stringify(sharedOf(cur))) queueSettings(shared);
    },
    [saveSettings],
  );

  const ready = loaded && sync.ready;
  const value = useMemo(
    () => ({ ready, prefs: sync.prefs, user: sync.user, settings, hijriOffset, dispatch, updateSettings }),
    [ready, sync.prefs, sync.user, settings, hijriOffset, dispatch, updateSettings],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
