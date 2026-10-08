/**
 * The admin's Hijri day offset (the local moon sighting) from the site's
 * /api/hijri-offset, passed to every src/lib/hijri-core call. The last value
 * read is kept on the device for when there's no connection; 0 before any.
 */
import { siteJson } from "./site";
import { readJson, writeJson } from "./storage";

const KEY = "hijri-offset";
/** src/lib/hijri.ts HIJRI_OFFSET_RANGE (that module needs the database, so it isn't imported here). */
const RANGE = 2;

const valid = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && Math.abs(v) <= RANGE;

export async function savedHijriOffset(): Promise<number> {
  const v = await readJson<number>(KEY);
  return valid(v) ? v : 0;
}

/** The site's current offset (saved for next time), or null when it can't be read. */
export async function fetchHijriOffset(): Promise<number | null> {
  try {
    const { offset } = await siteJson<{ offset: unknown }>("/api/hijri-offset");
    if (!valid(offset)) return null;
    await writeJson(KEY, offset);
    return offset;
  } catch {
    return null;
  }
}
