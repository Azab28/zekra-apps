/** Client-safe: the deceased's name on a «صدقة جارية» page, without a «رحمه الله» typed after it (the page adds its own). */
export const stripMercy = (name: string) =>
  name
    .replace(/[\s(]*(رحم(ه|ها|هما|هم)\s*الله(\s*تعالى)?|رحمة\s*الله\s*(عليه|عليها|عليهما|عليهم)|الله\s*يرحم(ه|ها))[\s)]*$/u, "")
    .replace(/^\(|\)$/g, "")
    .trim();
