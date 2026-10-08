/**
 * Weather for the chosen place from Open-Meteo (free, no key; the bot's rain
 * alerts use it too): the temperature in the top corner, and on tapping it the
 * current conditions and the next 7 days. Kept 30 minutes in local storage.
 */
import { fill, h, icon, modal } from "../lib/dom";
import { n } from "../lib/times";
import { S } from "./state";

type Forecast = {
  current: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; wind_speed_10m: number; weather_code: number; is_day: number };
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: (number | null)[] };
};

const CACHE_KEY = "weather.cache";
const FRESH_MS = 30 * 60_000;

/** WMO weather codes → words and an icon. */
function describe(code: number, day = true): [string, string] {
  if (code === 0) return ["صحو", day ? "sun" : "moon"];
  if (code <= 2) return ["غائم جزئيًا", "cloud-sun"];
  if (code === 3) return ["غائم", "cloud"];
  if (code <= 48) return ["ضباب", "cloud-fog"];
  if (code <= 57) return ["رذاذ", "cloud-drizzle"];
  if (code <= 67) return ["مطر", "cloud-rain"];
  if (code <= 77) return ["ثلج", "snowflake"];
  if (code <= 82) return ["زخات مطر", "cloud-rain"];
  if (code <= 86) return ["زخات ثلج", "snowflake"];
  return ["عاصفة رعدية", "cloud-lightning"];
}

async function forecast(): Promise<Forecast | null> {
  const place = S.place;
  if (!place) return null;
  const key = `${place.latitude},${place.longitude},${S.weather.unit}`;
  const cached = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] as { key: string; at: number; data: Forecast } | undefined;
  if (cached?.key === key && Date.now() - cached.at < FRESH_MS) return cached.data;
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "7",
    ...(S.weather.unit === "f" ? { temperature_unit: "fahrenheit" } : {}),
  }).toString();
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as Forecast;
    await chrome.storage.local.set({ [CACHE_KEY]: { key, at: Date.now(), data } });
    return data;
  } catch {
    return cached?.data ?? null;
  }
}

const deg = (t: number) => `${n(Math.round(t))}°`;

/** The chip in the top corner (nothing until a city is chosen or when offline). */
export async function weatherChip(): Promise<HTMLElement | null> {
  const f = await forecast();
  if (!f) return null;
  const [words, ic] = describe(f.current.weather_code, f.current.is_day === 1);
  return h("button", { type: "button", class: "chip chip-strong weather-chip", title: `${words} — الطقس`, onclick: openWeather }, icon(ic), deg(f.current.temperature_2m));
}

async function openWeather() {
  const body = h("div", { class: "weather" }, h("p", { class: "muted" }, "جارٍ التحميل…"));
  modal(`الطقس — ${S.place?.city ?? ""}`, body);
  const f = await forecast();
  if (!f) return fill(body, h("p", { class: "muted" }, "تعذّر جلب الطقس، تحقق من الاتصال."));
  const [words, ic] = describe(f.current.weather_code, f.current.is_day === 1);
  const dayName = (iso: string, i: number) =>
    i === 0 ? "اليوم" : i === 1 ? "غدًا" : new Intl.DateTimeFormat("ar-EG", { weekday: "long" }).format(new Date(`${iso}T12:00:00`));
  fill(
    body,
    h(
      "div",
      { class: "weather-now" },
      icon(ic, "icon big"),
      h("div", null, h("div", { class: "weather-temp" }, deg(f.current.temperature_2m)), h("div", null, words)),
      h(
        "ul",
        { class: "weather-facts" },
        h("li", null, icon("thermometer"), `المحسوسة ${deg(f.current.apparent_temperature)}`),
        h("li", null, icon("droplets"), `الرطوبة ${n(f.current.relative_humidity_2m)}٪`),
        h("li", null, icon("wind"), `الرياح ${n(Math.round(f.current.wind_speed_10m))} كم/س`),
      ),
    ),
    h("div", { class: "pop-sub" }, "الأيام السبعة القادمة"),
    h(
      "ol",
      { class: "weather-days" },
      ...f.daily.time.map((d, i) => {
        const [w, di] = describe(f.daily.weather_code[i]);
        const rain = f.daily.precipitation_probability_max[i];
        return h(
          "li",
          { class: "weather-day" },
          h("span", { class: "grow" }, dayName(d, i)),
          h("span", { class: "weather-desc", title: w }, icon(di), w),
          h("span", { class: "muted" }, rain ? `${n(rain)}٪ مطر` : ""),
          h("span", { class: "weather-range" }, h("strong", null, deg(f.daily.temperature_2m_max[i])), " / ", deg(f.daily.temperature_2m_min[i])),
        );
      }),
    ),
    h("p", { class: "muted small" }, "البيانات من Open-Meteo."),
  );
}
