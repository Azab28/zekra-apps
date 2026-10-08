/**
 * The fonts the dua poster (/dua-poster, /ali; src/lib/images/dua-poster.ts)
 * can be written in: Google Fonts families, all under the SIL Open Font
 * License, each one file from the google/fonts repository at a pinned commit
 * (served by jsDelivr), downloaded by the server on first use into
 * data/fonts/extra (src/lib/images/poster-fonts.ts; never committed). Amiri
 * and IBM Plex Sans Arabic are already in assets/fonts. Each was drawn with
 * the duas' marks («محسناً», «صبّر», «ضيقٍ») and kept only when they sit right;
 * rejected: Qahiri, Vibes, Ruwudu, Reem Kufi (heh like kaf), Kufam (final yeh
 * as ے), Aref Ruqaa Ink (fixed colours), Blaka, Harmattan, Lateef. Client-safe.
 */
export type PosterFont = {
  id: string;
  /** Shown in the picker (drawn in the font itself). */
  label: string;
  /** The family's name on Google Fonts. */
  family: string;
  /** Path under ofl/ in google/fonts, or `builtin` for a font in assets/fonts. */
  file: string;
  /** SHA-256 of that file, checked after download. */
  sha256?: string;
  /** The weight asked of it, a multiple of 100 (the canvas ignores a font string with another; variable fonts take any, static files their own). */
  weight: number;
};

/** google/fonts commit the files are taken from (2026-09-30). */
export const POSTER_FONT_COMMIT = "9710da1eacb3be272583c3224dcb70f9da6eadbb";

export const POSTER_FONTS: PosterFont[] = [
  { id: "naskh", label: "نسخ", family: "Noto Naskh Arabic", file: "notonaskharabic/NotoNaskhArabic[wght].ttf", sha256: "67b5a525a661b607971fbd3f96a81b89d3a768e74534fca84f18ac97e6fab72f", weight: 700 },
  { id: "scheherazade", label: "شهرزاد", family: "Scheherazade New", file: "scheherazadenew/ScheherazadeNew-Bold.ttf", sha256: "91363517a63dbc7448b5814226d33d845b26b32a461cd159ea0b3f23c7effd2d", weight: 700 },
  { id: "amiri", label: "أميري", family: "Amiri", file: "builtin", weight: 700 },
  { id: "markazi", label: "مركزي", family: "Markazi Text", file: "markazitext/MarkaziText[wght].ttf", sha256: "424b7331681160ff2a4b209bfc356ea9564d429a7daea43ee4dc28de8ff4f9fe", weight: 700 },
  { id: "mirza", label: "ميرزا", family: "Mirza", file: "mirza/Mirza-Bold.ttf", sha256: "306b412a39d9f93ca840c13ca62300eb5c7712e2afa94bd7ef2272b51131be6d", weight: 700 },
  { id: "katibeh", label: "كاتبة", family: "Katibeh", file: "katibeh/Katibeh-Regular.ttf", sha256: "334eeadb58eb442734fe7dea87412cbbd8c3fd00294252723aadf19a850cf11f", weight: 400 },
  { id: "ruqaa", label: "رقعة", family: "Aref Ruqaa", file: "arefruqaa/ArefRuqaa-Bold.ttf", sha256: "247071015b7eefd63f94d6e47949c5d10294ed31bd432f809ba9a219d93f91bb", weight: 700 },
  { id: "rakkas", label: "رقّاص", family: "Rakkas", file: "rakkas/Rakkas-Regular.ttf", sha256: "54278882e4774c14d50c3b555f127d0fe586366d5b787316ebbcbd8108829e60", weight: 400 },
  { id: "nastaliq", label: "نستعليق", family: "Noto Nastaliq Urdu", file: "notonastaliqurdu/NotoNastaliqUrdu[wght].ttf", sha256: "98a4787f34eb6fde57fb9a1121a8f216301196ab0da98ea110cad581be8abbcd", weight: 600 },
  { id: "kufi", label: "كوفي", family: "Noto Kufi Arabic", file: "notokufiarabic/NotoKufiArabic[wght].ttf", sha256: "494f6b61469d7a02a2d63f0fc4930bb007388d8cfe551de5eb98354e100889f3", weight: 700 },
  { id: "messiri", label: "المسيري", family: "El Messiri", file: "elmessiri/ElMessiri[wght].ttf", sha256: "5d58d5259d2accccba39cffe12e1226e88b6afc5150e3605eb2a9c2fe06ccab0", weight: 700 },
  { id: "cairo", label: "القاهرة", family: "Cairo", file: "cairo/Cairo[slnt,wght].ttf", sha256: "667c987182391c91f4e57a2f455b1794fb5e3ee6ca4ef3383e86bb690fa9c964", weight: 700 },
  { id: "tajawal", label: "تجوّل", family: "Tajawal", file: "tajawal/Tajawal-Bold.ttf", sha256: "0342ab6b74b6bd1b4b5bf7beda45a9734a2b3147a31e8a3a45b6a3417a52d9d7", weight: 700 },
  { id: "almarai", label: "المراعي", family: "Almarai", file: "almarai/Almarai-Bold.ttf", sha256: "06401391b5b39fbcf2bc0c6a6e03faf992435e7b011183a1861737e913af8613", weight: 700 },
  { id: "changa", label: "تشانغا", family: "Changa", file: "changa/Changa[wght].ttf", sha256: "7c4f7a14d4b70ac8816ea8df3a0b127aee4c5f5af7239aca2afecc84ddc7f4d3", weight: 600 },
  { id: "readex", label: "ريدكس", family: "Readex Pro", file: "readexpro/ReadexPro[HEXP,wght].ttf", sha256: "268bba7e1e8f3b14d798b3fb0e40ebaa3fc39308c9ac0020e2faf6df181cc30e", weight: 600 },
  { id: "alexandria", label: "الإسكندرية", family: "Alexandria", file: "alexandria/Alexandria[wght].ttf", sha256: "db8ae03b62d55a65aa4e04307878df8c00d6e5388e4800635cbe0e22b6411b64", weight: 600 },
  { id: "plex", label: "بلكس", family: "IBM Plex Sans Arabic", file: "builtin", weight: 700 },
  { id: "vazirmatn", label: "وزيرمتن", family: "Vazirmatn", file: "vazirmatn/Vazirmatn[wght].ttf", sha256: "696249a2c74b39ffdef55de4df2809c5b639d3ff80d618d8160a095d2fd49dca", weight: 700 },
  { id: "lalezar", label: "لاله‌زار", family: "Lalezar", file: "lalezar/Lalezar-Regular.ttf", sha256: "7b80807bc831f141de0f7dcf6816412bf0c548968d548c5156ca388733390ea9", weight: 400 },
  { id: "lemonada", label: "ليموناضة", family: "Lemonada", file: "lemonada/Lemonada[wght].ttf", sha256: "84134e9e1da7d593839073157980a4d38296d2be10b61469a8f3169204959ad9", weight: 600 },
  { id: "marhey", label: "مرحي", family: "Marhey", file: "marhey/Marhey[wght].ttf", sha256: "19c30686157ec965797fae8c8feb7bb142b082217227562d1a809c067df447e9", weight: 600 },
];

/** Noto Naskh Arabic: a plain, well-marked naskh, the closest to printed duas. */
export const DEFAULT_POSTER_FONT = "naskh";

const BY_ID = new Map(POSTER_FONTS.map((f) => [f.id, f]));

export const isPosterFont = (id: string) => BY_ID.has(id);

/** The font for `id`, else the default. */
export const posterFont = (id: string | null | undefined): PosterFont => BY_ID.get(id ?? "") ?? BY_ID.get(DEFAULT_POSTER_FONT)!;

/** Where a font file is downloaded from (jsDelivr's copy of google/fonts at the pinned commit). */
export const posterFontUrl = (f: PosterFont) =>
  `https://cdn.jsdelivr.net/gh/google/fonts@${POSTER_FONT_COMMIT}/ofl/${f.file.split("/").map(encodeURIComponent).join("/")}`;
