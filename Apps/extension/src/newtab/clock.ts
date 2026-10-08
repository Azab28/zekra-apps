/** The time with the Gregorian and Hijri dates (top corner), and the next occasion (bottom centre). */
import { DateTime } from "luxon";
import { hijriLabel, upcomingEvents } from "../../../../src/lib/hijri-core";
import { $, fill, h, icon, siteUrl } from "../lib/dom";
import { n } from "../lib/times";
import { S, zone } from "./state";

let last = "";

export function renderClock(force = false) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("ar-EG", { hour: "numeric", minute: "2-digit", hour12: !S.clock24, timeZone: zone() }).formatToParts(now);
  const time = parts.filter((p) => p.type !== "dayPeriod").map((p) => p.value).join("").trim();
  const period = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
  const key = `${time}|${period}|${S.hijriOffset}`;
  if (key === last && !force) return;
  last = key;
  const today = DateTime.now().setZone(zone()).startOf("day");
  const greg = new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: zone() }).format(now);
  fill(
    $("#clock"),
    h("div", { class: "time" }, time, period && h("span", { class: "period" }, period)),
    h("div", { class: "dates" }, h("span", null, greg), h("span", null, hijriLabel(today, S.hijriOffset))),
  );
  renderOccasion(today);
}

/** «الأيام البيض بعد ٢٣ يومًا», «الجمعة · غدًا»: the nearer of the next occasion and Friday. */
function renderOccasion(today: DateTime) {
  const next = upcomingEvents(today, S.hijriOffset, 60)[0];
  const daysToFriday = (5 - today.weekday + 7) % 7;
  let label: string;
  let days: number;
  if (next && next.days <= daysToFriday) {
    // The shared labels start with an emoji; the extension's UI uses none.
    label = next.label.replace(/^[^؀-ۿ]+/, "");
    days = next.days;
  } else {
    label = "الجمعة";
    days = daysToFriday;
  }
  const when = days === 0 ? "اليوم" : days === 1 ? "غدًا" : days === 2 ? "بعد غد" : `بعد ${n(days)} ${days <= 10 ? "أيام" : "يومًا"}`;
  fill($("#occasion"), h("a", { class: "chip", href: siteUrl("/hijri"), title: "التقويم الهجري" }, icon("calendar-days"), `${label} · ${when}`));
}
