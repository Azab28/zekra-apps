/**
 * A place by its address or name, in Arabic or Latin letters ("القاهرة",
 * "Cairo"): OpenStreetMap's Nominatim, or Open-Meteo's place names
 * when it doesn't answer. Searched on Enter only (Nominatim's usage policy
 * forbids searching as you type).
 */
import { NEAR_KM, nearestCity } from "../../../../src/lib/cities";

export type Found = { name: string; detail: string; latitude: number; longitude: number; timezone?: string };
type Near = { latitude: number; longitude: number } | null | undefined;

async function nominatim(q: string, near: Near): Promise<Found[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  const params: Record<string, string> = { q, format: "jsonv2", limit: "8", "accept-language": "ar" };
  // Places around the current one first (farther ones still come).
  if (near) params.viewbox = [near.longitude - 5, near.latitude + 5, near.longitude + 5, near.latitude - 5].map((x) => x.toFixed(2)).join(",");
  url.search = new URLSearchParams(params).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  const rows = (await res.json()) as { name?: string; display_name: string; lat: string; lon: string }[];
  return rows.map((r) => {
    const parts = r.display_name.split(/،\s*|,\s*/);
    const name = r.name || parts[0];
    return { name, detail: parts.filter((p) => p !== name && !/^\d+$/.test(p)).join("، "), latitude: Number(r.lat), longitude: Number(r.lon) };
  });
}

async function openMeteo(q: string): Promise<Found[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({ name: q, count: "8", language: "ar" }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  const data = (await res.json()) as { results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number; timezone?: string }[] };
  return (data.results ?? []).map((r) => ({
    name: r.name,
    detail: [r.admin1, r.country].filter(Boolean).join("، "),
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
  }));
}

export async function searchPlaces(q: string, near?: Near): Promise<Found[]> {
  let got = await nominatim(q, near).catch(() => [] as Found[]);
  if (!got.length) got = await openMeteo(q).catch(() => []);
  const seen = new Set<string>();
  return got.filter((f) => {
    const key = `${f.name}|${f.detail}`;
    return !seen.has(key) && !!seen.add(key);
  });
}

/** The place's time zone: Open-Meteo says it for any point; else the nearest listed city's, else this computer's. */
export async function timezoneAt(latitude: number, longitude: number): Promise<string> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), timezone: "auto", daily: "sunrise", forecast_days: "1" }).toString();
    const res = await fetch(url);
    const zone = res.ok ? ((await res.json()) as { timezone?: string }).timezone : undefined;
    if (zone && zone !== "GMT") return zone;
  } catch {
    // offline: below
  }
  const near = nearestCity(latitude, longitude);
  return near.d <= NEAR_KM ? near.c.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone;
}
