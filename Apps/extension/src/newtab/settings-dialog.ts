/**
 * The settings window: a sidebar of pages (general, background, ayah, prayer,
 * notices and adhan, zikr reminders, listening, shortcuts, search, data, about), one page
 * shown at a time.
 */
import { AYAH_RECITERS } from "../../../../src/lib/ayah-audio";
import { CALC_METHODS, MAX_ADJUST_MINUTES } from "../../../../src/lib/schedule/prayer-calc";
import { BACKGROUNDS, saveCustomBackground } from "../lib/backgrounds";
import { $, choiceDialog, confirmDialog, fill, h, icon, modal, siteUrl, toast } from "../lib/dom";
import { NEAR_KM, nearestCity } from "../../../../src/lib/cities";
import {
  ADHAN_PRAYERS,
  ADHAN_VOICES,
  ALARM_BEFORE,
  BEFORE_CHOICES,
  isGlass,
  THEMES,
  type BgCategory,
  type Settings,
  type Theme,
} from "../lib/settings";
import { minutesLabel, n, PRAYER_NAMES, prayerLabel } from "../lib/times";
import { chooseBackground, refreshBackground, showCustom, shownBackground } from "./background";
import { chooseCity, cityOptions, cityValue, setPlace } from "./prayers";
import { S, update } from "./state";
import { selectRow, toggleRow } from "./ui";
import { AYAH_ACTION_LABELS, AYAH_ACTIONS, ENGINES, SUGGEST_ORIGIN, TOOLS, ZIKR_EVERY, type ControlPlace, type ToolId } from "../lib/settings";
import { applyParts, collectParts, deviceId, PARTS, partsOf, pull, push, remoteMeta, type Backup, type Part } from "../lib/sync";
import { openEditor } from "./dock";
import { startWelcome } from "./welcome";
import { BROWSER_TOOLS, browserName } from "./browser";
import { searchPlaces, timezoneAt, type Found } from "../lib/geocode";
import { STATIONS } from "../lib/radio";
import { moshafLabel, RECITERS } from "../lib/reciters";
import { loadWird, nextAlarm, saveWird, wirdProgress } from "../lib/listen";
import { JUZ_STARTS, SURAHS } from "../lib/quran";

let tab: BgCategory | null = null;
let sample: HTMLAudioElement | null = null;

type Page = { id: string; label: string; icon: string; sections: () => (Node | false | null | undefined)[] };
const PAGES: Page[] = [
  { id: "general", label: "عام", icon: "settings", sections: () => [lookSection(), toolsSection()] },
  { id: "background", label: "الخلفية", icon: "image", sections: () => [backgroundSection()] },
  { id: "ayah", label: "إعدادات الآية", icon: "book-open", sections: () => [quranSection(), controlsSection()] },
  { id: "prayer", label: "مواقيت الصلاة", icon: "clock", sections: () => [prayerSection()] },
  { id: "notice", label: "التنبيهات والأذان", icon: "bell", sections: () => [noticeSection()] },
  { id: "zikr", label: "التذكيرات", icon: "moon-star", sections: zikrSection },
  { id: "listen", label: "الاستماع", icon: "headphones", sections: listenSection },
  { id: "shortcuts", label: "اختصارات", icon: "layout-grid", sections: () => [shortcutsSection()] },
  { id: "search", label: "البحث", icon: "search", sections: () => [searchSection()] },
  { id: "data", label: "إدارة البيانات", icon: "upload", sections: dataSection },
  { id: "about", label: "عن ذِكرى", icon: "info", sections: () => [about()] },
];
/** Old section names that other parts open the settings at. */
const PAGE_OF: Record<string, string> = { quran: "ayah", controls: "ayah", look: "general", tools: "general", sync: "data" };
let page = "general";

export function openSettings(section?: string) {
  const dlg = $<HTMLDialogElement>("#settings");
  if (section) page = PAGES.some((p) => p.id === section) ? section : (PAGE_OF[section] ?? page);
  renderSettings();
  if (!dlg.open) dlg.showModal();
}

export function renderSettings() {
  const dlg = $<HTMLDialogElement>("#settings");
  const scroll = dlg.querySelector(".settings-body")?.scrollTop ?? 0;
  const samePage = dlg.dataset.page === page;
  dlg.dataset.page = page;
  tab ??= S.background.category;
  const current = PAGES.find((p) => p.id === page) ?? PAGES[0];
  fill(
    dlg,
    h(
      "div",
      { class: "settings-head" },
      h("h2", null, "الإعدادات"),
      h("button", { class: "round-btn", type: "button", "aria-label": "إغلاق", onclick: () => dlg.close() }, icon("x")),
    ),
    h(
      "div",
      { class: "settings-layout" },
      h(
        "nav",
        { class: "settings-nav", "aria-label": "أقسام الإعدادات" },
        ...PAGES.map((p) =>
          h(
            "button",
            {
              type: "button",
              class: `nav-item${p.id === current.id ? " on" : ""}`,
              "aria-current": p.id === current.id ? "page" : null,
              onclick: () => {
                page = p.id;
                renderSettings();
              },
            },
            icon(p.icon),
            h("span", null, p.label),
          ),
        ),
      ),
      h("div", { class: "settings-body" }, ...current.sections()),
    ),
  );
  // Same page redrawn after a change: keep the scroll; another page starts at the top.
  dlg.querySelector(".settings-body")!.scrollTop = samePage ? scroll : 0;
}

$<HTMLDialogElement>("#settings").addEventListener("close", () => {
  sample?.pause();
  sample = null;
});

function section(id: string, title: string, ...children: (Node | false | null | undefined)[]) {
  return h("section", { class: "set-section", id: `set-${id}` }, h("h3", null, title), h("div", { class: "set-box" }, ...children));
}

const notify = (patch: Partial<Settings["notify"]>) => update((s) => ({ ...s, notify: { ...s.notify, ...patch } }));
const background = (patch: Partial<Settings["background"]>) => update((s) => ({ ...s, background: { ...s.background, ...patch } }));
const adhan = (patch: Partial<Settings["adhan"]>) => update((s) => ({ ...s, adhan: { ...s.adhan, ...patch } }));
const ayah = (patch: Partial<Settings["ayah"]>) => update((s) => ({ ...s, ayah: { ...s.ayah, ...patch } }));

/** A slider row; `oninput` previews, the value is saved when let go. */
function sliderRow(label: string, value: number, min: number, max: number, step: number, show: (v: number) => string, save: (v: number) => void, oninput?: (v: number) => void) {
  const out = h("output", null, show(value));
  return h(
    "label",
    { class: "set-row" },
    h("span", null, label),
    h(
      "span",
      { class: "slider" },
      h("input", {
        type: "range",
        min: String(min),
        max: String(max),
        step: String(step),
        value: String(value),
        oninput: (e: Event) => {
          const v = Number((e.target as HTMLInputElement).value);
          out.textContent = show(v);
          oninput?.(v);
        },
        onchange: (e: Event) => save(Number((e.target as HTMLInputElement).value)),
      }),
      out,
    ),
  );
}

const percent = (v: number) => `${n(Math.round(v * 100))}٪`;

function backgroundSection() {
  const tabs: [BgCategory, string][] = [
    ["islamic", "إسلامي"],
    ["nature", "طبيعة"],
    ["favorites", "المفضلة"],
    ["custom", "من جهازك"],
  ];
  const current = shownBackground();
  let body: Node;
  if (tab === "custom") {
    const file = h("input", {
      type: "file",
      accept: "image/*",
      hidden: true,
      onchange: async (e: Event) => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (!f) return;
        try {
          await saveCustomBackground(f);
          await background({ category: "custom" });
          await showCustom();
          toast("تم تعيين الخلفية");
        } catch {
          toast("تعذّر فتح الصورة");
        }
      },
    });
    body = h(
      "div",
      { class: "custom-bg" },
      h("p", { class: "muted" }, "اختر صورة من جهازك، تُحفظ في المتصفح فقط."),
      h("button", { class: "btn primary", type: "button", onclick: () => file.click() }, icon("upload"), "اختيار صورة"),
      file,
    );
  } else {
    const list = tab === "favorites" ? BACKGROUNDS.filter((b) => S.background.favorites.includes(b.id)) : BACKGROUNDS.filter((b) => b.category === tab);
    body = h(
      "div",
      null,
      tab === "favorites" && list.length > 0 && h("p", { class: "note" }, icon("info"), "مع التغيير التلقائي تتبدّل الخلفيات بين المفضلة فقط."),
      list.length
        ? h(
            "div",
            { class: "bg-grid" },
            ...list.map((b) => {
              const fav = S.background.favorites.includes(b.id);
              const selected = current?.bg?.id === b.id;
              return h(
                "div",
                { class: `bg-thumb${selected ? " on" : ""}`, style: `background-color: ${b.color}` },
                h(
                  "button",
                  { type: "button", class: "bg-pick", title: `${b.title} — ${b.author}`, "aria-label": b.title, onclick: () => void chooseBackground(b).then(renderSettings) },
                  h("img", { src: b.thumb, alt: "", loading: "lazy" }),
                  selected && h("span", { class: "check" }, icon("check")),
                ),
                h(
                  "button",
                  {
                    type: "button",
                    class: `fav${fav ? " on" : ""}`,
                    title: fav ? "إزالة من المفضلة" : "إضافة إلى المفضلة",
                    "aria-pressed": String(fav),
                    onclick: () =>
                      void background({ favorites: fav ? S.background.favorites.filter((x) => x !== b.id) : [...S.background.favorites, b.id] }).then(renderSettings),
                  },
                  icon("heart"),
                ),
              );
            }),
          )
        : h("p", { class: "muted empty" }, "اضغط على القلب في أي خلفية لتظهر هنا."),
    );
  }
  return section(
    "background",
    "الخلفية",
    !isGlass(S.theme) && h("p", { class: "note" }, icon("info"), "الخلفيات تظهر في المظهر الزجاجي."),
    h(
      "div",
      { class: "set-row" },
      h("span", null, "نوع الخلفية"),
      h(
        "div",
        { class: "tabs" },
        ...tabs.map(([v, label]) =>
          h(
            "button",
            {
              type: "button",
              class: `tab${tab === v ? " on" : ""}`,
              "aria-pressed": String(tab === v),
              onclick: () => {
                tab = v;
                if (v !== "custom") void background({ category: v });
                renderSettings();
              },
            },
            label,
          ),
        ),
      ),
    ),
    body,
    current?.bg &&
      h(
        "p",
        { class: "credit" },
        "الصورة: ",
        h("a", { href: current.bg.source, target: "_blank", rel: "noreferrer" }, current.bg.title),
        ` — ${current.bg.author} (${current.bg.license})، من ويكيميديا كومنز.`,
      ),
  );
}

function lookSection() {
  return section(
    "look",
    "المظهر",
    selectRow("وضع المظهر", S.theme, THEMES, (v) => void update({ theme: v as Theme })),
    toggleRow("التغيير التلقائي للخلفيات", S.background.auto, (v) => void background({ auto: v }), "خلفية مختلفة مع كل تبويب جديد"),
    sliderRow(
      "ضبابية الخلفية",
      S.background.blur,
      0,
      30,
      1,
      (v) => (v ? n(v) : "بدون"),
      (v) => void background({ blur: v }).then(refreshBackground),
      (v) => {
        document.documentElement.style.setProperty("--bg-blur", `${v}px`);
        document.documentElement.style.setProperty("--bg-blur-scale", String(v * 0.004));
      },
    ),
    toggleRow("نظام ٢٤ ساعة", S.clock24, (v) => void update({ clock24: v })),
  );
}

function quranSection() {
  return section(
    "quran",
    "القرآن الكريم",
    selectRow(
      "الآية في كل تبويب",
      S.ayah.order,
      [
        ["random", "آية مختارة عشوائيًا"],
        ["mushaf", "بترتيب المصحف (تكمل من حيث توقفت)"],
      ],
      (v) => void ayah({ order: v === "mushaf" ? "mushaf" : "random" }),
    ),
    selectRow("القارئ", S.reciter, AYAH_RECITERS.map((r) => [r.id, r.name] as [string, string]), (v) => void update({ reciter: v })),
    sliderRow("صوت التلاوة", S.ayah.volume, 0, 1, 0.05, percent, (v) => void ayah({ volume: v })),
    toggleRow("التفسير الميسر تحت الآية", S.tafsir, (v) => void update({ tafsir: v })),
  );
}

function prayerSection() {
  const place = S.place;
  const city = h("select", { class: "field", onchange: (e: Event) => chooseCity((e.target as HTMLSelectElement).value) }, ...cityOptions());
  city.value = cityValue();
  const adjust = (p: (typeof PRAYER_NAMES)[number]) => {
    const v = place?.prayerAdjust?.[p] ?? 0;
    return h(
      "label",
      { class: "adjust" },
      h("span", null, prayerLabel(p)),
      h("input", {
        class: "field",
        type: "number",
        min: String(-MAX_ADJUST_MINUTES),
        max: String(MAX_ADJUST_MINUTES),
        step: "1",
        value: String(v),
        "aria-label": `تعديل ${prayerLabel(p)} بالدقائق`,
        onchange: (e: Event) => {
          if (!place) return;
          const m = Math.max(-MAX_ADJUST_MINUTES, Math.min(MAX_ADJUST_MINUTES, Math.round(Number((e.target as HTMLInputElement).value) || 0)));
          void setPlace({ ...place, prayerAdjust: { ...(place.prayerAdjust ?? {}), [p]: m } });
        },
      }),
    );
  };
  return section(
    "prayer",
    "مواقيت الصلاة",
    h("label", { class: "set-row" }, h("span", null, "المدينة"), city),
    addressSearch(),
    h(
      "div",
      { class: "set-row" },
      h(
        "span",
        null,
        "الموقع بالإحداثيات",
        h("small", { dir: "ltr" }, place ? `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)} — ${place.timezone}` : "خط العرض وخط الطول"),
      ),
      h("button", { type: "button", class: "btn", onclick: coordinatesDialog }, icon("map-pin"), "إدخال الإحداثيات"),
    ),
    place &&
      selectRow(
        "طريقة الحساب",
        place.calcMethod,
        Object.entries(CALC_METHODS).map(([k, m]) => [k, m.label] as [string, string]),
        (v) => void setPlace({ ...place, calcMethod: v }),
      ),
    place &&
      selectRow(
        "مذهب العصر",
        place.madhab ?? "shafi",
        [
          ["shafi", "الجمهور (الشافعي)"],
          ["hanafi", "الحنفي"],
        ],
        (v) => void setPlace({ ...place, madhab: v === "hanafi" ? "hanafi" : "shafi" }),
      ),
    place && h("div", { class: "set-row wrap" }, h("span", null, "تعديل المواعيد بالدقائق", h("small", null, "لتوافق مسجدك (±٣٠)")), h("div", { class: "adjusts" }, ...PRAYER_NAMES.map(adjust))),
    selectRow(
      "التاريخ الهجري",
      String(S.hijriOffset),
      [-2, -1, 0, 1, 2].map((d) => [String(d), d === 0 ? "حسب تقويم أم القرى" : `${d > 0 ? "+" : "−"}${n(Math.abs(d))} ${Math.abs(d) === 1 ? "يوم" : "يومان"}`] as [string, string]),
      (v) => void update({ hijriOffset: Number(v) }),
    ),
    toggleRow("إظهار الأسماء والمواعيد عند المرور فقط", S.prayer.compact, (v) => void update((s) => ({ ...s, prayer: { compact: v } }))),
  );
}

function noticeSection() {
  const play = h(
    "button",
    {
      type: "button",
      class: "round-btn small",
      title: "استمع",
      "aria-label": "استمع إلى الأذان",
      onclick: () => {
        if (sample) {
          sample.pause();
          sample = null;
          return;
        }
        sample = new Audio(`adhan/${S.adhan.voice}.mp3`);
        sample.volume = S.adhan.volume;
        sample.addEventListener("ended", () => (sample = null));
        void sample.play();
      },
    },
    icon("play"),
  );
  const voice = h(
    "select",
    { class: "field", onchange: (e: Event) => (sample?.pause(), (sample = null), void adhan({ voice: (e.target as HTMLSelectElement).value })) },
    ...ADHAN_VOICES.map(([id, label]) => h("option", { value: id }, label)),
  );
  voice.value = S.adhan.voice;
  return section(
    "notice",
    "التنبيهات والأذان",
    S.notify.paused && h("p", { class: "note" }, icon("bell-off"), "التنبيهات والأذان موقوفة من زر الجرس في بطاقة الصلاة."),
    adhanModeRow(),
    S.adhan.mode !== "off" && h("label", { class: "set-row" }, h("span", null, "المؤذن"), h("span", { class: "row" }, play, voice)),
    S.adhan.mode !== "off" && sliderRow("صوت الأذان", S.adhan.volume, 0, 1, 0.05, percent, (v) => void adhan({ volume: v }), (v) => sample && (sample.volume = v)),
    toggleRow("إشعار عند دخول وقت الصلاة", S.notify.atAdhan, (v) => void notify({ atAdhan: v })),
    selectRow(
      "تنبيه قبل الأذان",
      String(S.notify.before),
      BEFORE_CHOICES.map((m) => [String(m), m === 0 ? "بدون" : `قبله بـ${minutesLabel(m)}`] as [string, string]),
      (v) => void notify({ before: Number(v) }),
    ),
    h(
      "div",
      { class: "set-row wrap" },
      h("span", null, "الصلوات"),
      h(
        "div",
        { class: "chip-checks" },
        ...ADHAN_PRAYERS.map((p) =>
          h(
            "label",
            { class: "chip-check" },
            h("input", { type: "checkbox", checked: S.notify.prayers[p], onchange: (e: Event) => void notify({ prayers: { ...S.notify.prayers, [p]: (e.target as HTMLInputElement).checked } }) }),
            prayerLabel(p),
          ),
        ),
      ),
    ),
    toggleRow("أذكار الصباح والمساء", S.notify.azkar, (v) => void notify({ azkar: v }), "بعد الفجر وبعد العصر بنصف ساعة"),
    toggleRow("الوقت المتبقي على أيقونة الإضافة", S.badge, (v) => void update({ badge: v })),
  );
}

/** The adhan at each time: full, short, or a silent notification (also in the first-run guide). */
export function adhanModeRow() {
  return selectRow(
    "الأذان عند دخول الوقت",
    S.adhan.mode,
    [
      ["full", "الأذان كاملًا"],
      ["short", "الأذان مختصرًا (التكبيرات)"],
      ["off", "إشعار بدون صوت"],
    ],
    (v) => void adhan({ mode: v as Settings["adhan"]["mode"] }),
  );
}

/** Each button under the ayah: in the row, in «المزيد», or hidden. */
function controlsSection() {
  const places: [ControlPlace, string][] = [
    ["bar", "الشريط"],
    ["more", "المزيد"],
    ["off", "إخفاء"],
  ];
  return section(
    "controls",
    "أزرار الآية",
    h("p", { class: "note" }, icon("info"), "زر التشغيل و«المزيد» ثابتان دائمًا."),
    ...AYAH_ACTIONS.map((a) =>
      h(
        "div",
        { class: "set-row" },
        h("span", null, AYAH_ACTION_LABELS[a]),
        h(
          "div",
          { class: "segmented n3 small-seg" },
          ...places.map(([p, label]) =>
            h(
              "button",
              {
                type: "button",
                class: `seg${S.controls[a] === p ? " on" : ""}`,
                "aria-pressed": String(S.controls[a] === p),
                onclick: () => void update((st) => ({ ...st, controls: { ...st.controls, [a]: p } })),
              },
              label,
            ),
          ),
        ),
      ),
    ),
  );
}

function searchSection() {
  const search = (patch: Partial<Settings["search"]>) => update((st) => ({ ...st, search: { ...st.search, ...patch } }));
  return section(
    "search",
    "مربع البحث",
    __BROWSER__ === "chrome"
      ? toggleRow("إظهار مربع البحث", S.search.show, (v) => void search({ show: v }), `يبحث بمحرك البحث الذي اخترته في إعدادات ${browserName()}`)
      : toggleRow("إظهار مربع البحث", S.search.show, (v) => void search({ show: v })),
    // Edge and Firefox: an engine of the user's choice and Google's suggestions (Chrome's store allows neither on a new tab).
    __BROWSER__ !== "chrome" &&
      S.search.show &&
      selectRow("محرك البحث", S.search.engine, ENGINES.map((e) => [e.id, e.name] as [string, string]), (v) => void search({ engine: v })),
    __BROWSER__ !== "chrome" &&
      S.search.show &&
      toggleRow(
        "اقتراحات أثناء الكتابة",
        S.search.suggest,
        async (v) => {
          // Suggestions come from Google's service: allowed only when chosen.
          if (v && !(await chrome.permissions.request({ origins: [SUGGEST_ORIGIN] }).catch(() => false))) {
            toast("لم يُسمح بجلب الاقتراحات");
            return renderSettings();
          }
          void search({ suggest: v });
        },
        "من خدمة اقتراحات Google",
      ),
    __BROWSER__ !== "chrome" && S.search.show && toggleRow("إخفاء اختيار المحرك", S.search.hideEngines, (v) => void search({ hideEngines: v })),
    S.search.show && toggleRow("الاحتفاظ بالكلمات بعد البحث", S.search.keep, (v) => void search({ keep: v })),
    S.search.show && toggleRow("إخفاء زر البحث", S.search.hideButton, (v) => void search({ hideButton: v })),
    S.search.show &&
      selectRow(
        "حجم المربع",
        S.search.size,
        [
          ["s", "صغير"],
          ["m", "متوسط"],
          ["l", "كبير"],
        ],
        (v) => void search({ size: v as Settings["search"]["size"] }),
      ),
  );
}

function toolsSection() {
  const labels: Record<ToolId, string> = {
    weather: "الطقس",
    todo: "المهام",
    notes: "الملاحظات",
    bookmarks: "الإشارات المرجعية",
    history: "السجل",
    extensions: "إدارة الإضافات",
    apps: `تطبيقات ${browserName()}`,
    azkar: "أذكار وأدعية",
  };
  return section(
    "tools",
    "أدوات الزاوية العلوية",
    ...TOOLS.filter(BROWSER_TOOLS).map((t) => toggleRow(labels[t], S.tools[t], (v) => void update((st) => ({ ...st, tools: { ...st.tools, [t]: v } })))),
    S.tools.weather &&
      selectRow(
        "درجة الحرارة",
        S.weather.unit,
        [
          ["c", "مئوية °C"],
          ["f", "فهرنهايت °F"],
        ],
        (v) => void update({ weather: { unit: v === "f" ? "f" : "c" } }),
      ),
  );
}

/** Any place by its latitude and longitude (the timezone from the device or the nearest listed city). */
/** A place by its address (for the prayer times and the weather). */
export function addressSearch() {
  const results = h("div", { class: "geo-results", "aria-live": "polite" });
  const input = h("input", { class: "field", type: "search", placeholder: "القاهرة أو Cairo", "aria-label": "ابحث بالعنوان", maxlength: "120" });
  let seq = 0;
  const go = async () => {
    const q = input.value.trim();
    if (q.length < 2) return;
    const mine = ++seq;
    fill(results, h("p", { class: "muted small" }, "جارٍ البحث…"));
    const found = await searchPlaces(q, S.place);
    if (mine !== seq) return;
    if (!found.length) return void fill(results, h("p", { class: "muted small" }, "لم نجد هذا العنوان. جرّب اسم المدينة أو الحي."));
    fill(
      results,
      ...found.map((f) =>
        h(
          "button",
          { type: "button", class: "geo-item", onclick: () => void pickFound(f) },
          icon("map-pin"),
          h("span", null, h("strong", null, f.name), f.detail && h("small", null, f.detail)),
        ),
      ),
    );
  };
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    void go();
  });
  return h(
    "div",
    { class: "set-row wrap" },
    h("span", null, "ابحث بالعنوان", h("small", null, "حي أو مدينة أو شارع، بالعربية أو الإنجليزية")),
    h("div", { class: "geo" }, h("div", { class: "row" }, input, h("button", { type: "button", class: "btn", onclick: () => void go() }, icon("search"), "بحث")), results),
  );
}

async function pickFound(f: Found) {
  const place = S.place;
  const near = nearestCity(f.latitude, f.longitude);
  const latitude = Math.round(f.latitude * 1e4) / 1e4;
  const longitude = Math.round(f.longitude * 1e4) / 1e4;
  await setPlace({
    city: f.name.slice(0, 40),
    timezone: f.timezone ?? (await timezoneAt(latitude, longitude)),
    latitude,
    longitude,
    calcMethod: near.d <= NEAR_KM ? near.c.calcMethod : (place?.calcMethod ?? "MuslimWorldLeague"),
    prayerAdjust: place?.prayerAdjust ?? null,
    madhab: place?.madhab ?? "shafi",
  });
  toast(`الموقع: ${f.name}`);
}

function coordinatesDialog() {
  const place = S.place;
  const num = (label: string, value: number | undefined, min: number, max: number) =>
    h("input", { class: "field", type: "number", step: "0.0001", min: String(min), max: String(max), value: value != null ? String(value) : "", "aria-label": label, dir: "ltr", required: true });
  const lat = num("خط العرض", place?.latitude, -90, 90);
  const lon = num("خط الطول", place?.longitude, -180, 180);
  const name = h("input", { class: "field", maxlength: "40", placeholder: "مثل: البيت", value: place?.city.replace(/ \(موقعك\)$/, "") ?? "" });
  const zone = h(
    "select",
    { class: "field", dir: "ltr" },
    ...[...new Set([Intl.DateTimeFormat().resolvedOptions().timeZone, ...(Intl.supportedValuesOf?.("timeZone") ?? [])])].map((z) => h("option", { value: z }, z)),
  );
  zone.value = place?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Typed coordinates near a listed city take its timezone (still changeable by hand).
  let zoneTouched = false;
  zone.addEventListener("change", () => (zoneTouched = true));
  const follow = () => {
    const la = Number(lat.value);
    const lo = Number(lon.value);
    if (zoneTouched || !lat.value || !lon.value || !Number.isFinite(la) || !Number.isFinite(lo)) return;
    const near = nearestCity(la, lo);
    if (near.d <= NEAR_KM) zone.value = near.c.timezone;
  };
  lat.addEventListener("input", follow);
  lon.addEventListener("input", follow);
  const form = h(
    "form",
    {
      class: "coords",
      onsubmit: (e: Event) => {
        e.preventDefault();
        const la = Number(lat.value);
        const lo = Number(lon.value);
        if (!lat.value || !lon.value || !(la >= -90 && la <= 90) || !(lo >= -180 && lo <= 180)) return toast("اكتب خط عرض بين ‎-90 و90 وخط طول بين ‎-180 و180");
        const near = nearestCity(la, lo);
        void setPlace({
          city: name.value.trim() || (near.d <= NEAR_KM ? `قرب ${near.c.name}` : "موقع مخصص"),
          timezone: zone.value,
          latitude: Math.round(la * 1e4) / 1e4,
          longitude: Math.round(lo * 1e4) / 1e4,
          calcMethod: place?.calcMethod ?? (near.d <= NEAR_KM ? near.c.calcMethod : "MuslimWorldLeague"),
          prayerAdjust: place?.prayerAdjust ?? null,
          madhab: place?.madhab ?? "shafi",
        });
        m.close();
        toast("حُفظ الموقع");
      },
    },
    h("div", { class: "form-grid two" }, h("label", { class: "set-field" }, "خط العرض (Latitude)", lat), h("label", { class: "set-field" }, "خط الطول (Longitude)", lon)),
    h("label", { class: "set-field" }, "الاسم", name),
    h("label", { class: "set-field" }, "المنطقة الزمنية", zone),
    h("p", { class: "muted small" }, "تجد الإحداثيات في خرائط Google: اضغط مطولًا على المكان وانسخ الرقمين."),
  );
  const m = modal("الموقع بالإحداثيات", form, {
    cls: "dialog",
    footer: h(
      "div",
      { class: "row end" },
      h("button", { type: "button", class: "btn ghost", onclick: () => m.close() }, "إلغاء"),
      h("button", { type: "button", class: "btn primary", onclick: () => form.requestSubmit() }, "حفظ"),
    ),
  });
  lat.focus();
}

/** Quran Tab's «التذكيرات»: a zikr every so often, its recording if chosen; each zikr can be left out. */
function zikrSection() {
  const z = S.zikr;
  const set = (patch: Partial<Settings["zikr"]>) => update((st) => ({ ...st, zikr: { ...st.zikr, ...patch } }));
  const playOne = (id: string) => {
    sample?.pause();
    sample = new Audio(`zikr/${id}.mp3`);
    sample.volume = z.volume;
    void sample.play();
  };
  return [
    section(
      "zikr",
      "تذكير الأذكار",
      toggleRow("تذكير الأذكار", z.on, (v) => void set({ on: v }), "يذكّرك بذكر الله على فترات تختارها."),
      h(
        "div",
        { class: "set-row" },
        h("span", null, "ذكّرني كل"),
        h(
          "div",
          { class: "segmented n4 small-seg wide-seg" },
          ...ZIKR_EVERY.map(([m, label]) =>
            h("button", { type: "button", class: `seg${z.every === m ? " on" : ""}`, "aria-pressed": String(z.every === m), onclick: () => void set({ every: m }) }, label),
          ),
        ),
      ),
      toggleRow("تشغيل الصوت", z.sound, (v) => void set({ sound: v })),
      z.sound && sliderRow("مستوى الصوت", z.volume, 0, 1, 0.05, percent, (v) => void set({ volume: v }), (v) => sample && (sample.volume = v)),
    ),
    section(
      "zikr-list",
      "الأذكار",
      ...__ZIKR__.map((x) =>
        h(
          "div",
          { class: "set-row zikr-row" },
          h("button", { type: "button", class: "round-btn small", title: "استمع", "aria-label": `استمع: ${x.text}`, onclick: () => playOne(x.id) }, icon("play")),
          h("span", { class: "zikr-phrase grow" }, x.text),
          h("input", {
            type: "checkbox",
            class: "switch",
            checked: !z.off.includes(x.id),
            "aria-label": x.text,
            onchange: (e: Event) => {
              const on = (e.target as HTMLInputElement).checked;
              void set({ off: on ? z.off.filter((i) => i !== x.id) : [...z.off, x.id] });
            },
          }),
        ),
      ),
    ),
  ];
}

/** The popup's recordings: the reciter for suggestions, the wird, the Quran alarm. */
function listenSection() {
  const l = S.listen;
  const set = (patch: Partial<Settings["listen"]>) => update((st) => ({ ...st, listen: { ...st.listen, ...patch } }));
  const alarm = (patch: Partial<Settings["listen"]["alarm"]>) => set({ alarm: { ...l.alarm, ...patch } });
  const surahOptions = SURAHS.map(([name], i) => [String(i + 1), `${n(i + 1)}. ${name}`] as [string, string]);

  // The wird's place, read when the page opens.
  const progress = h("small", null, "…");
  const juzPick = h("select", { class: "field", "aria-label": "ابدأ من الجزء" }, ...JUZ_STARTS.map((_, i) => h("option", { value: String(i + 1) }, `الجزء ${n(i + 1)}`)));
  void loadWird().then((w) => {
    const p = wirdProgress(w);
    progress.textContent = `الجزء ${n(p.juz)} (${n(Math.round(p.part * 100))}٪) — الختمة ${n(Math.round(p.whole * 100))}٪${w.khatmas ? ` — ختمات مكتملة: ${n(w.khatmas)}` : ""}`;
    juzPick.value = String(p.juz);
  });
  juzPick.addEventListener("change", () => {
    void loadWird().then((w) => saveWird({ ...w, pos: JUZ_STARTS[Number(juzPick.value) - 1], doneDay: null })).then(() => {
      toast("سيبدأ الورد من أول الجزء المختار");
      renderSettings();
    });
  });

  const at = nextAlarm(S);
  const when = at
    ? new Intl.DateTimeFormat("ar-EG", { weekday: "long", hour: "numeric", minute: "2-digit", hour12: !S.clock24 }).format(at)
    : l.alarm.on && l.alarm.mode === "fajr" && !S.place
      ? "اختر مدينتك أولًا من صفحة مواقيت الصلاة"
      : null;
  const time = h("input", { class: "field", type: "time", value: l.alarm.time, "aria-label": "الوقت", onchange: (e: Event) => (e.target as HTMLInputElement).value && void alarm({ time: (e.target as HTMLInputElement).value }) });

  return [
    section(
      "listen",
      "التلاوات",
      selectRow(
        "القارئ للسور المقترحة والمنبّه",
        String(l.moshaf),
        RECITERS.flatMap((r) => r.moshaf.filter((m) => m.surahs.length >= 100).map((m) => [String(m.id), moshafLabel(m.id)] as [string, string])),
        (v) => void set({ moshaf: Number(v) }),
      ),
      toggleRow("اقتراح سور حسب الوقت", l.suggest, (v) => void set({ suggest: v }), "الكهف يوم الجمعة، الملك قبل النوم، والبقرة كل بضعة أيام — في نافذة الإذاعة"),
      toggleRow("تذكير بسورة الكهف صباح الجمعة", l.kahf, (v) => void set({ kahf: v }), "إشعار في العاشرة صباحًا فيه زر للاستماع"),
    ),
    section(
      "wird",
      "ورد الاستماع",
      toggleRow("جزء كل يوم", l.wird.on, (v) => void set({ wird: { ...l.wird, on: v } }), "يظهر في نافذة الإذاعة، ويكمل من حيث توقفت آية بآية"),
      l.wird.on && selectRow("القارئ", l.wird.reciter, AYAH_RECITERS.map((r) => [r.id, r.name] as [string, string]), (v) => void set({ wird: { ...l.wird, reciter: v } })),
      l.wird.on && h("div", { class: "set-row" }, h("span", null, "وصلت إلى", progress), juzPick),
      l.wird.on &&
        h(
          "div",
          { class: "set-row" },
          h("span", null, "ختمة جديدة", h("small", null, "يرجع الورد إلى أول المصحف")),
          h(
            "button",
            {
              type: "button",
              class: "btn",
              onclick: async () => {
                if (!(await confirmDialog("يرجع ورد الاستماع إلى سورة الفاتحة. عدد الختمات المكتملة يبقى كما هو.", { title: "ختمة جديدة", ok: "ابدأ من الأول" }))) return;
                await saveWird({ ...(await loadWird()), pos: 0, doneDay: null });
                renderSettings();
              },
            },
            icon("refresh-cw"),
            "ابدأ من الأول",
          ),
        ),
    ),
    section(
      "alarm",
      "منبّه القرآن",
      toggleRow("منبّه بالقرآن", l.alarm.on, (v) => void alarm({ on: v }), "يعلو الصوت تدريجيًا خلال دقيقة، والمتصفح يجب أن يكون مفتوحًا"),
      l.alarm.on &&
        h(
          "div",
          { class: "set-row" },
          h("span", null, "الموعد"),
          h(
            "div",
            { class: "segmented small-seg wide-seg" },
            ...(
              [
                ["fajr", "قبل الفجر"],
                ["time", "وقت محدد"],
              ] as const
            ).map(([m, label]) =>
              h("button", { type: "button", class: `seg${l.alarm.mode === m ? " on" : ""}`, "aria-pressed": String(l.alarm.mode === m), onclick: () => void alarm({ mode: m }) }, label),
            ),
          ),
        ),
      l.alarm.on &&
        l.alarm.mode === "fajr" &&
        selectRow(
          "قبل الأذان بـ",
          String(l.alarm.before),
          ALARM_BEFORE.map((m) => [String(m), m === 0 ? "عند الأذان" : minutesLabel(m)] as [string, string]),
          (v) => void alarm({ before: Number(v) }),
        ),
      l.alarm.on && l.alarm.mode === "time" && h("label", { class: "set-row" }, h("span", null, "الوقت"), time),
      l.alarm.on &&
        selectRow(
          "ماذا يُشغَّل",
          l.alarm.play,
          [
            ["surah", "سورة"],
            ["live", "إذاعة مباشرة"],
          ],
          (v) => void alarm({ play: v === "live" ? "live" : "surah", station: l.alarm.station || STATIONS[0]?.id || 0 }),
        ),
      l.alarm.on && l.alarm.play === "surah" && selectRow("السورة", String(l.alarm.surah), surahOptions, (v) => void alarm({ surah: Number(v) })),
      l.alarm.on && l.alarm.play === "live" && selectRow("الإذاعة", String(l.alarm.station), STATIONS.map((st) => [String(st.id), st.name] as [string, string]), (v) => void alarm({ station: Number(v) })),
      l.alarm.on && !!when && h("p", { class: "note" }, icon("alarm-clock"), at ? `المنبّه القادم: ${when}` : when),
    ),
  ];
}

/** The shortcuts' main switches; the full editor opens from here. */
function shortcutsSection() {
  return section(
    "shortcuts",
    "شريط الاختصارات",
    h(
      "div",
      { class: "set-row" },
      h("span", null, "الروابط والمجموعات", h("small", null, "إضافة وترتيب وإخفاء من الشريط، والمجموعات الجاهزة")),
      h("button", { type: "button", class: "btn primary", onclick: () => ($<HTMLDialogElement>("#settings").close(), openEditor()) }, icon("pencil"), "تعديل الاختصارات"),
    ),
    toggleRow("فتح الروابط في تبويب جديد", S.dock.newTab, (v) => void update((st) => ({ ...st, dock: { ...st.dock, newTab: v } }))),
    toggleRow("زر الإعدادات في الشريط", S.dock.showGear, (v) => void update((st) => ({ ...st, dock: { ...st.dock, showGear: v } }))),
  );
}

/** The copy in the browser's account, and files of the parts the user picks. */
function dataSection() {
  const status = h("p", { class: "muted small" });
  void (async () => {
    const [meta, local, me] = await Promise.all([remoteMeta().catch(() => null), chrome.storage.local.get(["backup.error"]), deviceId()]);
    const when = (ms: number) => new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(ms);
    status.textContent =
      local["backup.error"] === "too-big"
        ? "البيانات أكبر من مساحة الحساب (حوالي ١٠٠ ك.ب): احذف بعض الملاحظات أو استعمل النسخ إلى ملف."
        : meta
          ? `آخر نسخة في الحساب: ${when(meta.at)}${meta.device === me ? " (من هذا الجهاز)" : " (من جهاز آخر)"}`
          : "لا توجد نسخة في الحساب بعد.";
  })();
  const enable = async (on: boolean) => {
    if (!on) return void update({ sync: false });
    const [meta, me] = await Promise.all([remoteMeta().catch(() => null), deviceId()]);
    // A copy from another computer: merge it in first, or start over from this one.
    if (meta && meta.device !== me) {
      const how = await choiceDialog("نسخة من جهاز آخر", "في حسابك نسخة من جهاز آخر. ماذا تريد؟", [
        ["merge", "دمجها مع هذا الجهاز", true],
        ["mine", "استبدالها ببيانات هذا الجهاز"],
      ]);
      if (!how) return renderSettings();
      if (how === "merge") await pull("merge");
    }
    await update({ sync: true });
    await push().catch(() => toast("تعذّر النسخ إلى الحساب"));
    renderSettings();
  };
  return [
    section(
      "sync",
      `المزامنة مع حساب ${browserName()}`,
      toggleRow("المزامنة", S.sync, (v) => void enable(v), "نسخة من الإعدادات والاختصارات والمهام والملاحظات في حسابك"),
      status,
      S.sync &&
        h(
          "div",
          { class: "row" },
          h("button", { type: "button", class: "btn", onclick: () => void push().then(() => (toast("تم النسخ"), renderSettings()), () => toast("تعذّر النسخ")) }, icon("upload"), "انسخ الآن"),
          h(
            "button",
            {
              type: "button",
              class: "btn",
              onclick: async () => {
                if (!(await confirmDialog("دمج النسخة التي في حسابك مع بيانات هذا الجهاز؟", { ok: "دمج" }))) return;
                const b = await pull("merge").catch(() => null);
                if (!b) return toast("لا توجد نسخة في الحساب");
                location.reload();
              },
            },
            icon("download"),
            "دمج من الحساب",
          ),
        ),
      h(
        "details",
        { class: "explain" },
        h("summary", null, "كيف تعمل المزامنة؟"),
        h(
          "p",
          null,
          `تستخدم مساحة المزامنة في حسابك المسجّل في ${browserName()} نفسه (${{ chrome: "Google", edge: "Microsoft", firefox: "Mozilla" }[__BROWSER__]}): لو سجّلت الدخول بحسابك في المتصفح وفعّلت مزامنة «الإضافات»، تصل النسخة لكل أجهزتك. لا نرسل بياناتك لأي خادم لنا، ولا تحتاج تسجيل دخول جديد. المساحة حوالي ١٠٠ ك.ب (تكفي آلاف المهام والملاحظات القصيرة). صور الاختصارات وخلفية الجهاز لا تُنسخ. عند فتح المتصفح على جهاز آخر تُدمج أحدث نسخة تلقائيًا: كل ملاحظة بآخر تعديل لها، والمهام حسب قوائمها.`,
        ),
      ),
    ),
    section(
      "files",
      "تصدير واستيراد",
      h(
        "div",
        { class: "set-row" },
        h("span", null, "تصدير إلى ملف", h("small", null, "اختر ما تريد حفظه")),
        h("button", { type: "button", class: "btn", onclick: exportDialog }, icon("download"), "تصدير"),
      ),
      h(
        "div",
        { class: "set-row" },
        h("span", null, "استيراد من ملف", h("small", null, "اختر ما تريد استرجاعه، دمجًا أو استبدالًا")),
        h("button", { type: "button", class: "btn", onclick: importFile }, icon("upload"), "استيراد"),
      ),
    ),
    // Firefox's build sends no daily count.
    __BROWSER__ !== "firefox" &&
    section(
      "stats",
      "إحصاءات الاستخدام",
      toggleRow(
        "إرسال إحصاءات مجهولة",
        S.stats,
        (v) => void update({ stats: v }),
        "مرة في اليوم: رقم الإصدار والمتصفح والأقسام المفعّلة فقط، بلا أي معرّف ولا محتوى. نعرف بها عدد المستخدمين وما يفيدهم.",
      ),
    ),
  ];
}

/** Checkboxes for the parts (all ticked unless `only` limits them). */
function partPicker(only?: Part[]) {
  const boxes = new Map<Part, HTMLInputElement>();
  const el = h(
    "div",
    { class: "chip-checks" },
    ...PARTS.filter(([p]) => !only || only.includes(p)).map(([p, label]) => {
      const box = h("input", { type: "checkbox", checked: true });
      boxes.set(p, box);
      return h("label", { class: "chip-check" }, box, label);
    }),
  );
  return { el, chosen: () => [...boxes].filter(([, b]) => b.checked).map(([p]) => p) };
}

function exportDialog() {
  const pick = partPicker();
  const m = modal("تصدير إلى ملف", h("div", null, h("p", { class: "dialog-text" }, "ما الذي تريد حفظه في الملف؟"), pick.el), {
    cls: "dialog",
    footer: h(
      "div",
      { class: "row end" },
      h("button", { type: "button", class: "btn ghost", onclick: () => m.close() }, "إلغاء"),
      h(
        "button",
        {
          type: "button",
          class: "btn primary",
          onclick: async () => {
            const parts = pick.chosen();
            if (!parts.length) return toast("اختر جزءًا واحدًا على الأقل");
            const b = await collectParts(parts);
            const a = h("a", {
              href: URL.createObjectURL(new Blob([JSON.stringify(b, null, 1)], { type: "application/json" })),
              download: `zekra-${parts.join("-")}-${new Date().toISOString().slice(0, 10)}.json`,
            });
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
            m.close();
          },
        },
        icon("download"),
        "تصدير",
      ),
    ),
  });
}

function importFile() {
  const input = h("input", {
    type: "file",
    accept: "application/json,.json",
    onchange: async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      // A backup with pictures is a few MB at most.
      if (file.size > 20 * 1024 * 1024) return toast("الملف أكبر من نسخة احتياطية لذِكرى");
      let b: Backup;
      try {
        b = JSON.parse(await file.text()) as Backup;
        if (!b || typeof b.data !== "object" || b.data === null || Array.isArray(b.data)) throw new Error();
      } catch {
        return toast("الملف غير صالح");
      }
      const has = partsOf(b);
      if (!has.length) return toast("الملف لا يحتوي بيانات معروفة");
      const pick = partPicker(has);
      const mode = h(
        "div",
        { class: "radios" },
        h("label", { class: "radio" }, h("input", { type: "radio", name: "import-mode", value: "merge", checked: true }), "دمج مع الموجود"),
        h("label", { class: "radio" }, h("input", { type: "radio", name: "import-mode", value: "replace" }), "استبدال الموجود"),
      );
      const m = modal(
        "استيراد من ملف",
        h("div", null, h("p", { class: "dialog-text" }, "ما الذي تريد استرجاعه؟"), pick.el, h("p", { class: "muted small" }, "المهام والملاحظات تُدمج أو تُستبدل، والإعدادات تُستبدل."), mode),
        {
          cls: "dialog",
          footer: h(
            "div",
            { class: "row end" },
            h("button", { type: "button", class: "btn ghost", onclick: () => m.close() }, "إلغاء"),
            h(
              "button",
              {
                type: "button",
                class: "btn primary",
                onclick: async () => {
                  const parts = pick.chosen();
                  if (!parts.length) return toast("اختر جزءًا واحدًا على الأقل");
                  const how = (mode.querySelector<HTMLInputElement>("input:checked")?.value ?? "merge") as "merge" | "replace";
                  await applyParts(b, parts, how);
                  location.reload();
                },
              },
              icon("upload"),
              "استيراد",
            ),
          ),
        },
      );
    },
  });
  input.click();
}

function about() {
  return h(
    "div",
    null,
    h(
      "button",
      {
        type: "button",
        class: "btn",
        onclick: () => {
          $<HTMLDialogElement>("#settings").close();
          startWelcome();
        },
      },
      icon("compass"),
      "جولة في الإضافة",
    ),
    aboutText(),
  );
}

function aboutText() {
  return h(
    "p",
    { class: "about" },
    "النصوص من المصحف الشريف (تنزيل) وحصن المسلم والتفسير الميسر، والرسم بخط مصحف المدينة النبوية. الخلفيات من ويكيميديا كومنز بتراخيص حرة. ",
    h("a", { href: siteUrl("/about") }, "عن ذِكرى"),
    " · ",
    h("a", { href: siteUrl("/extension/privacy") }, "الخصوصية وشروط الاستخدام"),
  );
}
