/** `node:path` for src/lib/content/data.ts in the app: only `join`. */
const join = (...parts: string[]) => parts.filter(Boolean).join("/").replace(/\/{2,}/g, "/");

export { join };
export default { join };
