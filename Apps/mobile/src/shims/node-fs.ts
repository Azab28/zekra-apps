/**
 * `node:fs` for src/lib/content/data.ts in the app (metro.config.js sends its
 * import here): readFileSync returns the data file bundled at build time, so
 * data.ts — and what's built on it (chapterById, mushaf pages, Quran search)
 * — works unchanged. Only the files listed here are bundled: each is the JSON
 * as one string, written into generated/data by metro.config.js (DATA_FILES).
 */
const g = globalThis as { process?: { cwd?: () => string } };
// data.ts joins the file name onto process.cwd(), which RN doesn't have.
g.process ??= {};
if (typeof g.process.cwd !== "function") g.process.cwd = () => "/";

const FILES: Record<string, () => string> = {
  "hisn.json": () => require("../../generated/data/hisn.js"),
  "quran.json": () => require("../../generated/data/quran.js"),
  "qcf.json": () => require("../../generated/data/qcf.js"),
  "reciters.json": () => require("../../generated/data/reciters.js"),
  "radios.json": () => require("../../generated/data/radios.js"),
  "tafsir-muyassar.json": () => require("../../generated/data/tafsir-muyassar.js"),
};

export function readFileSync(file: string): string {
  const name = String(file).split("/").pop() ?? "";
  const load = Object.hasOwn(FILES, name) ? FILES[name] : undefined;
  if (!load) throw new Error(`${name} isn't bundled in the app (src/shims/node-fs.ts)`);
  return load();
}

export default { readFileSync };
