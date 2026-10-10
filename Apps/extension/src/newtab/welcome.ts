/**
 * The first-run guide (a new install only, background.ts sets WELCOME_KEY;
 * «جولة في الإضافة» in «عن ذِكرى» opens it again): the project as a «صدقة
 * جارية» for his father with the dua for the deceased (__MEMORIAL__, out of
 * hisn.json at build time), the look, the ayah each tab (at random or a
 * khatma from Al-Fatiha), the place and the adhan — applied at
 * once, so the page behind shows them — then a tour that lights up each part of
 * the page in turn, and how to pin the extension to the toolbar.
 */
import { fill, h, icon, siteUrl } from "../lib/dom";
import { isGlass, THEMES, WELCOME_KEY } from "../lib/settings";
import { showFromStart } from "./ayah";
import { shuffleBackground } from "./background";
import { renderBottomEnd } from "./bottom";
import { chooseCity, cityOptions, cityValue, locate } from "./prayers";
import { addressSearch, adhanModeRow } from "./settings-dialog";
import { S, subscribe, update } from "./state";

type Spot = { target: string; title: string; text: string };
type Step = { card: () => (Node | false)[] } | Spot;

/** The parts of the page the tour lights up, in order (one that's hidden is passed over). */
const SPOTS: Spot[] = [
  {
    target: "#prayers",
    title: "مواقيت الصلاة",
    text: "الصلاة القادمة والوقت الباقي عليها، والخط يمتلئ مع مرور اليوم. زر الجرس يوقف التنبيهات والأذان، والتقويم يفتح التاريخ الهجري.",
  },
  {
    target: "#ayah",
    title: "آية مع كل تبويب",
    text: "بخط مصحف المدينة النبوية: استمع إليها، واقرأ تفسيرها، واحفظها في المفضلة أو شاركها صورة. ترتيب الآيات والقارئ من الإعدادات.",
  },
  {
    target: "#search",
    title: "البحث",
    text: __BROWSER__ === "chrome" ? "ابحث في الويب بمحرك البحث الذي اخترته في المتصفح." : "ابحث في الويب، واختر محرك البحث من الزر بجانب المربع.",
  },
  { target: "#dock", title: "الاختصارات", text: "مواقعك المفضلة ومجموعات منها: أضف وعدّل ورتّب، واختر مكان الشريط وحجمه من الإعدادات." },
  {
    target: "#tools",
    title: "الأدوات",
    text: "الطقس، والمهام بتذكيراتها، والملاحظات، والإشارات المرجعية والسجل، و«أذكار وأدعية». ما لا تحتاجه تخفيه من الإعدادات.",
  },
  { target: "#bottom-start", title: "الإذاعة والتلاوات", text: "إذاعات القرآن الكريم والتلاوات المسجلة وورد الاستماع اليومي، وتبقى تعمل وأنت تتصفح." },
  {
    target: "#bottom-end",
    title: "الإعدادات",
    text: "المظهر والخلفيات، والمواقيت والأذان، والتذكير بالذكر، والاستماع، والمزامنة بين أجهزتك. وفي «عن ذِكرى» تجد هذه الجولة مرة أخرى.",
  },
];

const PIN: Record<typeof __BROWSER__, string> = {
  chrome: "اضغط على زر الإضافات (قطعة الأحجية) بجانب شريط العنوان، ثم على الدبوس بجانب «ذِكرى».",
  edge: "اضغط على زر الإضافات (قطعة الأحجية) بجانب شريط العنوان، ثم على رمز العين بجانب «ذِكرى» لتظهر في شريط الأدوات.",
  firefox: "اضغط على زر الإضافات (قطعة الأحجية) بجانب شريط العنوان، ثم على الترس بجانب «ذِكرى» واختر التثبيت في شريط الأدوات.",
};

let dlg: HTMLDialogElement | null = null;
let at = 0;
let shown = -1;

function dedication(): Node[] {
  return [
    h("img", { class: "wl-logo", src: "icons/128.png", alt: "" }),
    h("h2", null, "صدقة جارية"),
    h("p", { class: "wl-lead" }, `هذه الإضافة، ومعها كل مشروع ذِكرى: الموقع وتطبيق الجوال وتطبيق الكمبيوتر، صدقة جارية عن ${__MEMORIAL__.name}، رحمه الله.`),
    h("p", null, "إن انتفعت بها فلا تنسه من دعائك:"),
    h("blockquote", { class: "wl-dua" }, __MEMORIAL__.dua),
    h("p", { class: "muted small" }, __MEMORIAL__.source),
    h("a", { class: "chip", href: siteUrl("/"), target: "_blank", rel: "noopener" }, h("img", { class: "brand-mark", src: "icons/32.png", alt: "" }), "موقع ذِكرى"),
  ];
}

function look(): (Node | false)[] {
  return [
    h("h2", null, "اختر الشكل"),
    h("p", { class: "muted" }, "يتغير التبويب خلف هذه النافذة مباشرة، وتغيّره متى شئت من الإعدادات."),
    h(
      "div",
      { class: "wl-themes", role: "radiogroup", "aria-label": "الشكل" },
      ...THEMES.map(([id, label]) =>
        h(
          "button",
          { type: "button", class: `wl-theme t-${id}`, role: "radio", "aria-checked": String(S.theme === id), onclick: () => void update({ theme: id }) },
          h("span", { class: "wl-swatch", "aria-hidden": "true" }, h("span"), h("span")),
          label,
        ),
      ),
    ),
    isGlass(S.theme) && h("button", { type: "button", class: "chip", onclick: () => void shuffleBackground().then(renderBottomEnd) }, icon("image"), "صورة أخرى"),
  ];
}

/** The ayah each tab: a curated pick at random, or a khatma from Al-Fatiha on (shown behind at once). */
function ayahOrder(): Node[] {
  const choice = (order: "random" | "mushaf", ic: string, title: string, text: string) =>
    h(
      "button",
      {
        type: "button",
        class: "wl-choice",
        role: "radio",
        "aria-checked": String(S.ayah.order === order),
        onclick: () => {
          if (S.ayah.order === order) return;
          void update((s) => ({ ...s, ayah: { ...s.ayah, order } }));
          if (order === "mushaf") showFromStart();
        },
      },
      icon(ic),
      h("strong", null, title),
      h("span", null, text),
    );
  return [
    h("h2", null, "الآية في كل تبويب"),
    h("p", { class: "muted" }, "وتغيّرها متى شئت من الإعدادات ← إعدادات الآية."),
    h(
      "div",
      { class: "wl-choices", role: "radiogroup", "aria-label": "الآية في كل تبويب" },
      choice("random", "shuffle", "آية عشوائية", "آية أو مقطع مختار مختلف مع كل تبويب جديد."),
      choice("mushaf", "book-open", "ختمة القرآن", "من أول الفاتحة إلى آخر سورة الناس، آية بعد آية مع كل تبويب جديد، وتكمل من حيث توقفت."),
    ),
  ];
}

function place(): Node[] {
  const city = h("select", { class: "field", onchange: (e: Event) => chooseCity((e.target as HTMLSelectElement).value) }, ...cityOptions());
  city.value = cityValue();
  return [
    h("h2", null, "مكانك"),
    h("p", { class: "muted" }, "لتظهر مواقيت الصلاة ويصلك الأذان في وقته. لا يُرسل موقعك إلى ذِكرى."),
    h(
      "div",
      { class: "wl-place" },
      h("button", { type: "button", class: "btn primary", onclick: () => void locate() }, icon("locate-fixed"), "حدّد موقعي"),
      S.place ? h("strong", null, icon("map-pin"), S.place.city) : h("span", { class: "muted" }, "أو اختر مدينتك أو ابحث بالعنوان:"),
    ),
    h("div", { class: "set-box" }, h("label", { class: "set-row" }, h("span", null, "المدينة"), city), addressSearch(), adhanModeRow()),
  ];
}

function pin(): Node[] {
  return [
    h("span", { class: "wl-icon", "aria-hidden": "true" }, icon("puzzle")),
    h("h2", null, "ثبّت ذِكرى بجانب شريط العنوان"),
    h("p", null, PIN[__BROWSER__]),
    h("p", { class: "muted" }, "ومنها تشغّل الإذاعة والتلاوات وتوقفها دون فتح تبويب، ويظهر عليها الوقت الباقي على الصلاة."),
  ];
}

/** A part counts when it is on the page and takes up room (hidden tools and an empty dock don't). */
function visible(target: string) {
  const r = document.querySelector(target)?.getBoundingClientRect();
  return !!r && r.width > 0 && r.height > 0;
}

const steps = (): Step[] => [{ card: dedication }, { card: look }, { card: ayahOrder }, { card: place }, ...SPOTS.filter((s) => visible(s.target)), { card: pin }];

function render() {
  if (!dlg) return;
  const list = steps();
  at = Math.min(at, list.length - 1);
  const step = list[at];
  const last = at === list.length - 1;
  const go = (to: number) => {
    at = to;
    render();
  };
  const next = h("button", { type: "button", class: "btn primary wl-next", onclick: () => (last ? finish() : go(at + 1)) }, last ? "ابدأ" : "التالي", !last && icon("chevron-left"));
  const nav = h(
    "div",
    { class: "wl-nav" },
    at > 0 && !last ? h("button", { type: "button", class: "btn ghost", onclick: finish }, "تخطّي") : h("span"),
    h("div", { class: "wl-dots", "aria-hidden": "true" }, ...list.map((_, i) => h("span", { class: i === at ? "on" : i < at ? "done" : "" }))),
    h("div", { class: "row" }, at > 0 && h("button", { type: "button", class: "btn ghost", onclick: () => go(at - 1) }, icon("chevron-right"), "السابق"), next),
  );

  if ("card" in step) {
    dlg.dataset.mode = "card";
    fill(dlg, h("div", { class: "wl-card panel" }, h("div", { class: "wl-body" }, ...step.card()), nav));
  } else {
    dlg.dataset.mode = "spot";
    const ring = h("div", { class: "wl-ring" });
    const bubble = h("div", { class: "wl-bubble panel" }, h("h2", null, step.title), h("p", null, step.text), nav);
    fill(dlg, ring, bubble);
    positionSpot(document.querySelector(step.target)!, ring, bubble);
  }
  // Focus moves with the step, not when the same step redraws (a theme picked, a city chosen).
  if (shown !== at) {
    shown = at;
    next.focus();
  }
}

/** The ring around the part and the bubble beside it: below, above, or to its side, inside the window. */
function positionSpot(el: Element, ring: HTMLElement, bubble: HTMLElement) {
  const r = el.getBoundingClientRect();
  const pad = 8;
  const gap = 14;
  Object.assign(ring.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + 2 * pad}px`, height: `${r.height + 2 * pad}px` });
  const bw = bubble.offsetWidth;
  const bh = bubble.offsetHeight;
  const clamp = (v: number, max: number) => Math.max(12, Math.min(v, max - 12));
  let left = clamp(r.left + r.width / 2 - bw / 2, innerWidth - bw);
  let top: number;
  if (r.bottom + pad + gap + bh <= innerHeight - 12) top = r.bottom + pad + gap;
  else if (r.top - pad - gap - bh >= 12) top = r.top - pad - gap - bh;
  else {
    // A tall part (the dock on a side): beside it, on the roomier side.
    left = r.left > innerWidth - r.right ? r.left - pad - gap - bw : r.right + pad + gap;
    left = clamp(left, innerWidth - bw);
    top = clamp(r.top + r.height / 2 - bh / 2, innerHeight - bh);
  }
  Object.assign(bubble.style, { left: `${left}px`, top: `${top}px` });
}

function finish() {
  void chrome.storage.local.remove(WELCOME_KEY);
  close();
}

function close() {
  const d = dlg;
  dlg = null;
  if (d?.open) d.close();
  d?.remove();
}

export function startWelcome() {
  if (dlg) return;
  at = 0;
  shown = -1;
  dlg = h("dialog", { class: "welcome", "aria-label": "دليل ذِكرى" });
  // Escape ends the guide like «تخطّي».
  dlg.addEventListener("cancel", (e) => (e.preventDefault(), finish()));
  document.body.append(dlg);
  dlg.showModal();
  render();
}

/** Opens the guide on a new install's first tab; another tab closes it once it's done in one. */
export async function welcomeOnFirstRun() {
  subscribe(render);
  window.addEventListener("resize", render);
  chrome.storage.onChanged.addListener((changes, area) => area === "local" && Object.hasOwn(changes, WELCOME_KEY) && !changes[WELCOME_KEY].newValue && close());
  if ((await chrome.storage.local.get(WELCOME_KEY))[WELCOME_KEY]) startWelcome();
}
