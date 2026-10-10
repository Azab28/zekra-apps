/**
 * The prayer card: the current period and the time to the next prayer, and a
 * timeline of the day's six times (names and times on hover when compact);
 * the calendar and a mute for every notification. The city, method, madhab
 * and notices live in the settings (settings-dialog.ts).
 */
import { CITIES, NEAR_KM, nearestCity } from "../../../../src/lib/cities";
import type { PrayerName } from "../../../../src/lib/types";
import { $, fill, h, icon, siteUrl, toast } from "../lib/dom";
import type { ExtPlace } from "../lib/settings";
import { formatTime, n, nextPrayer, PRAYER_NAMES, placeDay, prayerLabel, timesOn } from "../lib/times";
import { openSettings } from "./settings-dialog";
import { deviceZone, S, update } from "./state";
import { iconButton, openUrl } from "./ui";

const ICONS: Record<PrayerName, string> = {
  fajr: "moon-star",
  sunrise: "sunrise",
  dhuhr: "sun",
  asr: "sun-medium",
  maghrib: "sunset",
  isha: "moon",
};

/** «٣س ٣٤د», «٤٥د». */
function hm(ms: number) {
  const mins = Math.max(0, Math.ceil(ms / 60_000));
  const hrs = Math.floor(mins / 60);
  return hrs ? `${n(hrs)}س ${n(mins % 60)}د` : `${n(mins)}د`;
}

export function renderPrayers() {
  const box = $("#prayers");
  const place = S.place;
  box.classList.toggle("compact", S.prayer.compact);
  if (!place) {
    fill(
      box,
      h(
        "div",
        { class: "prayers-empty" },
        h("div", null, h("strong", null, "مواقيت الصلاة"), h("div", { class: "muted" }, "اختر مدينتك لتظهر المواقيت وتصلك التنبيهات.")),
        h(
          "div",
          { class: "row" },
          h("button", { class: "chip chip-strong", type: "button", onclick: () => void locate() }, icon("locate-fixed"), "حدّد موقعي"),
          h("button", { class: "chip", type: "button", onclick: () => openSettings("prayer") }, icon("map-pin"), "اختر المدينة"),
        ),
      ),
    );
    return;
  }
  const now = Date.now();
  const today = timesOn(place, placeDay(place, 0, now));
  const next = nextPrayer(place, now);
  // The period we're in: the last time that passed (before fajr it is still last night's isha).
  const passed = PRAYER_NAMES.filter((p) => today[p].getTime() <= now);
  const current: PrayerName = passed.at(-1) ?? "isha";
  const nextToday = today[next.prayer].getTime() === next.at.getTime();
  // How far along the line the day is, in segments (0 at fajr, 5 at isha): full up to the
  // current time, then the part of the way to the next one that has passed.
  const ci = passed.length - 1;
  const following = PRAYER_NAMES[ci + 1];
  const progress =
    ci < 0 ? 0 : following ? ci + Math.min(1, (now - today[PRAYER_NAMES[ci]].getTime()) / (today[following].getTime() - today[PRAYER_NAMES[ci]].getTime())) : ci;

  fill(
    box,
    h(
      "div",
      { class: "prayer-head" },
      iconButton("calendar-days", "التقويم الهجري", () => openUrl(siteUrl("/hijri"), S.dock.newTab), "small"),
      h("strong", { class: "grow" }, `${hm(next.at.getTime() - now)} حتى ${prayerLabel(next.prayer)}`),
      iconButton(
        S.notify.paused ? "bell-off" : "bell",
        S.notify.paused ? "تشغيل التنبيهات والأذان" : "إيقاف التنبيهات والأذان",
        () => void update((s) => ({ ...s, notify: { ...s.notify, paused: !s.notify.paused } })),
        `small${S.notify.paused ? " off" : ""}`,
      ),
    ),
    h(
      "ol",
      { class: "timeline", style: `--progress: ${progress.toFixed(3)}` },
      ...PRAYER_NAMES.map((p) => {
        const state = p === current ? "current" : nextToday && p === next.prayer ? "next" : today[p].getTime() < now ? "past" : "";
        const at = formatTime(today[p], place.timezone, S.clock24);
        return h(
          "li",
          { class: `stop ${state}`, "aria-current": p === current ? "time" : null, title: `${prayerLabel(p)} ${at}`, tabindex: S.prayer.compact ? "0" : null },
          h("span", { class: "node" }, icon(ICONS[p])),
          h("span", { class: "name" }, prayerLabel(p)),
          h("span", { class: "at" }, at),
        );
      }),
    ),
  );
}

export const setPlace = (place: ExtPlace) => update({ place });

/** The city list as options grouped by country (values are CITIES indexes; "locate" asks the device). */
export function cityOptions(): HTMLElement[] {
  const place = S.place;
  const known = place ? CITIES.findIndex((c) => c.name === place.city) : -1;
  const countries = [...new Set(CITIES.map((c) => c.country))];
  return [
    ...(place && known < 0 ? [h("option", { value: "here" }, place.city)] : []),
    ...(!place ? [h("option", { value: "", disabled: true }, "اختر المدينة")] : []),
    h("option", { value: "locate" }, "حدّد موقعي"),
    ...countries.map((country) =>
      h(
        "optgroup",
        { label: country },
        ...CITIES.map((c, i) => [c, i] as const)
          .filter(([c]) => c.country === country)
          .map(([c, i]) => h("option", { value: String(i) }, c.name)),
      ),
    ),
  ];
}

export function cityValue() {
  const place = S.place;
  const known = place ? CITIES.findIndex((c) => c.name === place.city) : -1;
  return known >= 0 ? String(known) : place ? "here" : "";
}

export function chooseCity(v: string) {
  if (v === "locate") return void locate();
  const c = CITIES[Number(v)];
  const place = S.place;
  if (c)
    void setPlace({
      city: c.name,
      timezone: c.timezone,
      latitude: c.latitude,
      longitude: c.longitude,
      calcMethod: c.calcMethod,
      prayerAdjust: place?.prayerAdjust ?? null,
      madhab: place?.madhab ?? "shafi",
    });
}

/** The place for a device location: the nearest listed city when close, else the exact point (as the site's /prayer). */
function placeAt(latitude: number, longitude: number): ExtPlace {
  const near = nearestCity(latitude, longitude);
  const close = near.d <= NEAR_KM;
  return {
    city: close ? `${near.c.name} (موقعك)` : "موقعك",
    timezone: deviceZone || near.c.timezone,
    latitude: Math.round(latitude * 1e4) / 1e4,
    longitude: Math.round(longitude * 1e4) / 1e4,
    calcMethod: close ? near.c.calcMethod : "MuslimWorldLeague",
    prayerAdjust: S.place?.prayerAdjust ?? null,
    madhab: S.place?.madhab ?? "shafi",
  };
}

/** The device's location (the optional `geolocation` permission, asked from this click). */
export async function locate() {
  if (!(await chrome.permissions.request({ permissions: ["geolocation"] }).catch(() => false))) {
    toast("لم يُسمح بتحديد الموقع، ابحث بالعنوان أو اختر مدينتك من الإعدادات");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => void setPlace(placeAt(pos.coords.latitude, pos.coords.longitude)),
    () => {
      toast("لم نتمكن من تحديد موقعك، اختر مدينتك من القائمة");
      renderPrayers();
    },
    { timeout: 15_000, maximumAge: 3_600_000 },
  );
}
