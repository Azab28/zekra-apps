// Values scripts/build-extension.ts defines for the bundles.
declare const __SITE__: string;
/** Which store this build is for (scripts/build-extension.ts --browser). */
declare const __BROWSER__: "chrome" | "edge" | "firefox";
/** lucide icon bodies (the SVG's inner markup) by name. */
declare const __ICONS__: Record<string, [tag: string, attrs: Record<string, string>][]>;
declare const __AYAT__: import("./lib/types").ExtAyah[];
declare const __AZKAR__: import("./lib/types").ExtZikr[];
declare const __STATIONS__: import("./lib/types").ExtStation[];
/** mp3quran.net recitations (data/reciters.json). */
declare const __RECITERS__: import("./lib/types").ExtReciterRow[];
declare const __SURAHS__: import("./lib/quran").SurahMeta[];
declare const __BACKGROUNDS__: import("./lib/types").ExtBackground[];
declare const __JUZ__: number[];
/** The zikr reminder's phrases (words from hisn.json). */
declare const __ZIKR__: { id: string; text: string }[];
/** The first-run guide's dedication (scripts/build-extension.ts `memorial()`). */
declare const __MEMORIAL__: { name: string; dua: string; source: string };
