/**
 * Colour styles for the site and dashboard: each sets the hue of the theme
 * (`--h`, primary) and of its neutrals (`--n`) in globals.css, light and dark
 * alike. Chosen per device (html[data-palette], set before paint). Client-safe.
 */
export const PALETTES = [
  { id: "emerald", label: "زمرّدي", swatch: "oklch(0.46 0.095 166)" },
  { id: "turquoise", label: "فيروزي", swatch: "oklch(0.46 0.095 205)" },
  { id: "night", label: "أزرق ليلي", swatch: "oklch(0.46 0.095 258)" },
  { id: "violet", label: "بنفسجي", swatch: "oklch(0.46 0.095 305)" },
  { id: "garnet", label: "عنّابي", swatch: "oklch(0.46 0.095 15)" },
  { id: "sand", label: "رملي ذهبي", swatch: "oklch(0.46 0.095 65)" },
] as const;
export type PaletteId = (typeof PALETTES)[number]["id"];

export const PALETTE_KEY = "site:palette";
export const DEFAULT_PALETTE: PaletteId = "emerald";

export const isPalette = (v: unknown): v is PaletteId => typeof v === "string" && PALETTES.some((p) => p.id === v);

/** Runs before paint (root layout), so the page never flashes the default colours. */
export const PALETTE_BOOT = `try{var p=localStorage.getItem(${JSON.stringify(PALETTE_KEY)});if(p&&${JSON.stringify(PALETTES.map((p) => p.id))}.indexOf(p)>0)document.documentElement.setAttribute("data-palette",p)}catch(e){}`;
