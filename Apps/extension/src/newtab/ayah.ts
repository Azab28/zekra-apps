/**
 * The ayah card: a passage in the Madinah mushaf's script, flowing on one line
 * when it fits; a curated passage each tab or the mushaf in order. The next
 * tab's passage and its page fonts are prepared ahead, so it opens drawn.
 * Recitation ayah by ayah with its volume, «تكرار مقطع» (an ayah range, each
 * ayah and the whole repeated), favourites, التفسير الميسر under the text or in
 * its own window, and copy/share (share.ts).
 */
import { AYAH_RECITERS, ayahAudioUrl, ayahReciter } from "../../../../src/lib/ayah-audio";
import { foldArabic } from "../../../../src/lib/fold-arabic";
import { $, closePopover, fill, h, icon, modal, popover, siteUrl, toast } from "../lib/dom";
import { loadPage, pageFamily, prefetchPage } from "../lib/fonts";
import {
  ayahAt,
  ayatOf,
  curatedRange,
  juzRange,
  loadTafsir,
  pageOf,
  pageRange,
  rangeLabel,
  SURAHS,
  surahRange,
  wrap,
  type AyahView,
  type Range,
} from "../lib/quran";
import { AYAH_ACTIONS, type AyahAction } from "../lib/settings";
import { n } from "../lib/times";
import type { ExtAyah } from "../lib/types";
import { openShare } from "./share";
import { openSettings } from "./settings-dialog";
import { S, update } from "./state";
import { chipButton, iconButton, openUrl } from "./ui";

const CURATED: ExtAyah[] = __AYAT__;
const NEXT_KEY = "ayah.next";

let view: Range;
let ayat: AyahView[] = [];
/** The ayah being recited, or -1. */
let onAir = -1;
let audio: HTMLAudioElement | null = null;
/** «تكرار مقطع»: the range, times per ayah and for the whole (0 = forever). */
let loop: { range: Range; each: number; whole: number } | null = null;
let tafsir: string[] | null = null;

const surahLabel = (s: number) => {
  const [name, count, medinan] = SURAHS[s - 1];
  return `سورة ${name} (${medinan ? "مدنية" : "مكية"} - ${n(count)} آية)`;
};
const isFavorite = (r: Range) => S.ayah.favorites.some(([a, b]) => a === r.start && b === r.end);

// ---------- what to show ----------

type Prepared = { start: number; end: number; c?: number };

function pickNext(from: Range | null): Prepared {
  if (S.ayah.order === "mushaf" && from) {
    const i = wrap(from.end + 1);
    return { start: i, end: i };
  }
  const c = Math.floor(Math.random() * CURATED.length);
  return { ...curatedRange(CURATED[c]), c };
}

function readPrepared(): Prepared | null {
  try {
    const p = JSON.parse(localStorage.getItem(NEXT_KEY) ?? "null") as Prepared | null;
    if (!p || !Number.isInteger(p.start) || !Number.isInteger(p.end)) return null;
    // A curated pick only counts in random order, a single ayah only in mushaf order.
    if ((S.ayah.order === "random") !== (p.c != null)) return null;
    return p;
  } catch {
    return null;
  }
}

/** The tab's first passage: the one the previous tab prepared (its fonts already on disk). */
export function startAyah() {
  const p = readPrepared() ?? pickNext(null);
  void show({ start: p.start, end: p.end }, p.c != null ? CURATED[p.c] : undefined);
}

/** Picks the next tab's passage and puts its page fonts in the cache. */
async function prepareNext() {
  const p = pickNext(view);
  try {
    localStorage.setItem(NEXT_KEY, JSON.stringify(p));
  } catch {}
  const pages =
    p.c != null ? CURATED[p.c].ayahLines.flat().map((l) => l[0]) : [await pageOf(p.start)];
  for (const page of new Set(pages)) prefetchPage(page);
}

async function show(r: Range, from?: ExtAyah) {
  view = r;
  const box = $("#ayah");
  box.classList.add("busy");
  try {
    ayat = await ayatOf(r, from);
  } catch {
    toast("تعذّر تحميل الآيات");
    box.classList.remove("busy");
    return;
  }
  if (view !== r) return;
  renderAyahCard();
  box.classList.remove("busy");
  setTimeout(() => void prepareNext(), 1200);
}

const step = (dir: 1 | -1): Range => {
  const i = wrap(dir === 1 ? view.end + 1 : view.start - 1);
  return { start: i, end: i };
};

// ---------- drawing ----------

export function renderAyahCard() {
  const box = $("#ayah");
  if (!view) return;
  const { s } = ayahAt(view.start);
  const fav = isFavorite(view);
  fill(
    box,
    h(
      "div",
      { class: "chips" },
      chipButton("البحث في الآيات", (e) => searchPop(e.currentTarget as HTMLElement), "search"),
      chipButton(ayahReciter(S.reciter).name, (e) => reciterPop(e.currentTarget as HTMLElement), "mic", "القارئ"),
      chipButton(surahLabel(s), (e) => surahPop(e.currentTarget as HTMLElement), "book-open", "اختر سورة"),
    ),
    h("div", { class: "ayah-text", id: "ayah-text", lang: "ar" }),
    S.tafsir && h("button", { type: "button", class: "tafsir", id: "ayah-tafsir", title: "التفسير الميسر في نافذة", onclick: openTafsir }),
    h(
      "div",
      { class: "controls" },
      ...AYAH_ACTIONS.filter((a) => S.controls[a] === "bar").flatMap((a) => {
        const btn = actionButton(a, fav);
        // The play button sits after «السابقة» (or before the rest when that one is elsewhere).
        return a === "prev" ? [btn, playButton()] : [btn];
      }),
      S.controls.prev !== "bar" && playButton(),
      iconButton("ellipsis", "المزيد", (e) => morePop(e.currentTarget as HTMLElement)),
    ),
  );
  void drawText();
}

const playButton = () => iconButton(audio ? "pause" : "play", audio ? "إيقاف التلاوة" : "استمع", () => (audio ? stop() : void playFrom(view.start)), "play");

/** Each action under the ayah: its icon, label and what it does (the settings put it in the row, «المزيد» or nowhere). */
function action(a: AyahAction, fav: boolean): { icon: string; label: string; run: (anchor: HTMLElement) => void; cls?: string } {
  switch (a) {
    case "favorite":
      return { icon: "heart", label: fav ? "إزالة من المفضلة" : "إضافة إلى المفضلة", run: toggleFavorite, cls: fav ? "on fav" : "" };
    case "repeat":
      return { icon: loop ? "repeat-1" : "repeat", label: loop ? `تكرار: ${rangeLabel(loop.range, n)}` : "تكرار مقطع", run: () => void openRepeat(), cls: loop ? "on" : "" };
    case "prev":
      return { icon: "skip-forward", label: "الآية السابقة", run: () => void go(step(-1)) };
    case "next":
      return { icon: "skip-back", label: "الآية التالية", run: () => void go(step(1)) };
    case "volume":
      return { icon: S.ayah.volume === 0 ? "volume-x" : "volume-2", label: "مستوى الصوت", run: volumePop };
    case "share":
      return { icon: "share-2", label: "نسخ ومشاركة", run: () => openShare(view) };
    case "tafsir":
      return { icon: "book-open-text", label: "التفسير الميسر", run: () => void openTafsir() };
    case "mushaf":
      return { icon: "book-open", label: "افتح في المصحف", run: () => openUrl(siteUrl(`/mushaf/${ayat[0]?.lines[0]?.[0] ?? 1}`), S.dock.newTab) };
    case "shuffle":
      return {
        icon: "shuffle",
        label: S.ayah.order === "random" ? "آية أخرى" : "التالية بالترتيب",
        run: () => {
          stop();
          loop = null;
          const p = pickNext(S.ayah.order === "mushaf" ? view : null);
          void show({ start: p.start, end: p.end }, p.c != null ? CURATED[p.c] : undefined);
        },
      };
  }
}

function actionButton(a: AyahAction, fav: boolean) {
  const x = action(a, fav);
  return iconButton(x.icon, x.label, (e) => x.run(e.currentTarget as HTMLElement), x.cls ?? "");
}

async function drawText() {
  const text = document.getElementById("ayah-text");
  if (!text || !ayat.length) return;
  const shown = ayat;
  const pages = [...new Set(shown.flatMap((a) => a.lines.map((l) => l[0])))];
  // From the extension's cache after the first visit; offline, the text shows in Amiri Quran.
  const fonts = await Promise.race([
    Promise.all(pages.map((p) => loadPage(p))).then(() => true, () => false),
    new Promise<false>((r) => setTimeout(() => r(false), 4000)),
  ]);
  if (shown !== ayat) return;
  if (fonts && shown.every((a) => a.lines.length)) {
    fill(
      text,
      ...shown.map((a) =>
        h(
          "span",
          { class: `ayah${a.i === onAir ? " on-air" : ""}` },
          // A break may fall between any two words (each glyph is a word); printed lines are joined by a space.
          ...a.lines.map(([page, , codes]) => h("span", { class: "glyphs", style: `font-family: "${pageFamily(page)}"` }, [...codes].join("​"), " ")),
        ),
      ),
    );
    text.classList.remove("plain");
  } else {
    fill(text, ...shown.map((a) => h("span", { class: `ayah${a.i === onAir ? " on-air" : ""}` }, `${a.text} ۝${n(a.a)} `)));
    text.classList.add("plain");
  }
  fitText();
  void drawTafsir();
}

/** One line when it fits at a readable size, else wrapped. */
export function fitText() {
  const text = document.getElementById("ayah-text");
  if (!text) return;
  const max = Math.min(40, Math.max(26, innerWidth / 40));
  text.style.fontSize = `${max}px`;
  text.classList.add("measure");
  const width = text.scrollWidth;
  const room = text.clientWidth;
  text.classList.remove("measure");
  if (width > room) text.style.fontSize = `${Math.max(24, Math.floor((max * room) / width) - 1)}px`;
}

async function drawTafsir() {
  const box = document.getElementById("ayah-tafsir");
  if (!box) return;
  tafsir ??= await loadTafsir().catch(() => null);
  const a = ayat.find((x) => x.i === onAir) ?? ayat[0];
  if (!tafsir || !a) return;
  fill(box, h("span", { class: "tafsir-ref" }, `التفسير الميسر (${n(a.a)}): `), tafsir[a.i] ?? "");
}

async function go(r: Range) {
  const playing = !!audio;
  stop(false);
  loop = null;
  await show(r);
  if (playing) void playFrom(r.start);
}

// ---------- recitation ----------

/**
 * Plays from an ayah: through the «تكرار مقطع» range when set (each ayah
 * `each` times, the whole `whole` times or forever), else on through the mushaf.
 */
async function playFrom(i: number, eachDone = 0, wholeDone = 0) {
  stop(false);
  // Keep the shown passage when the ayah is in it; otherwise show that ayah (or the short range).
  if (i < view.start || i > view.end) {
    const r = loop && loop.range.end - loop.range.start < 5 ? loop.range : { start: i, end: i };
    await show(r);
  }
  const { s, a } = ayahAt(i);
  onAir = i;
  const player = new Audio(ayahAudioUrl(S.reciter, s, a));
  player.volume = S.ayah.volume;
  audio = player;
  player.addEventListener("ended", () => {
    if (audio !== player) return;
    if (loop) {
      const { range, each, whole } = loop;
      if (eachDone + 1 < each) return void playFrom(i, eachDone + 1, wholeDone);
      if (i < range.end) return void playFrom(i + 1, 0, wholeDone);
      if (whole === 0 || wholeDone + 1 < whole) return void playFrom(range.start, 0, wholeDone + 1);
      loop = null;
      return stop();
    }
    void playFrom(wrap(i + 1));
  });
  player.addEventListener("error", () => {
    if (audio !== player) return;
    stop();
    toast("تعذّر تشغيل التلاوة");
  });
  player.play().catch(() => stop());
  renderAyahCard();
}

function stop(redraw = true) {
  audio?.pause();
  audio = null;
  onAir = -1;
  if (redraw) renderAyahCard();
}

// ---------- «تكرار مقطع» ----------

async function openRepeat() {
  const choices: [string, () => Range | Promise<Range>][] = [
    [`الآيات ${rangeLabel(view, n)}`, () => view],
    ["هذه الصفحة", () => pageRange(view.start)],
    ["هذه السورة", () => surahRange(view.start)],
    ["هذا الجزء", () => juzRange(view.start)],
  ];
  let range: Range = loop?.range ?? view;
  let each = loop?.each ?? 1;
  let whole = loop?.whole ?? 1;
  const body = h("div", { class: "repeat" });
  const { s } = ayahAt(view.start);
  const [, count, , first] = SURAHS[s - 1];
  const sel = (value: number, onchange: (v: number) => void) => {
    const el = h(
      "select",
      { class: "field", onchange: (e: Event) => onchange(Number((e.target as HTMLSelectElement).value)) },
      ...Array.from({ length: count }, (_, k) => h("option", { value: String(first + k) }, n(k + 1))),
    );
    el.value = String(value);
    return el;
  };
  const times = (value: number, set: (v: number) => void, forever: boolean) =>
    h(
      "div",
      { class: "times" },
      ...[1, 3, 5, 10, ...(forever ? [0] : [])].map((t) =>
        h("button", { type: "button", class: `time${value === t ? " on" : ""}`, "aria-pressed": String(value === t), onclick: () => (set(t), draw()) }, t === 0 ? "∞" : `${n(t)}×`),
      ),
    );
  const draw = () => {
    const custom = range.start >= first && range.end < first + count;
    fill(
      body,
      h(
        "div",
        { class: "repeat-choices" },
        ...choices.map(([label, get]) =>
          h(
            "button",
            {
              type: "button",
              class: "choice",
              onclick: async () => {
                range = await get();
                draw();
              },
            },
            label,
          ),
        ),
      ),
      h(
        "div",
        { class: "set-box" },
        h("div", { class: "repeat-range" }, h("strong", null, rangeLabel(range, n)), h("span", { class: "muted" }, `${n(range.end - range.start + 1)} آية`)),
        h(
          "div",
          { class: "form-grid two" },
          h("label", { class: "set-field" }, "من الآية", sel(custom ? range.start : first, (v) => ((range = { start: v, end: Math.max(v, custom ? range.end : v) }), draw()))),
          h("label", { class: "set-field" }, "إلى الآية", sel(custom ? range.end : first, (v) => ((range = { start: Math.min(custom ? range.start : v, v), end: v }), draw()))),
        ),
      ),
      h("div", { class: "pop-sub" }, "كل آية"),
      times(each, (v) => (each = v), false),
      h("div", { class: "pop-sub" }, "المقطع كاملًا"),
      times(whole, (v) => (whole = v), true),
    );
  };
  draw();
  const footer = h(
    "div",
    { class: "row end" },
    loop &&
      h(
        "button",
        {
          type: "button",
          class: "btn ghost",
          onclick: () => {
            loop = null;
            m.close();
            stop();
          },
        },
        "إيقاف التكرار",
      ),
    h("button", { type: "button", class: "btn ghost", onclick: () => m.close() }, "إلغاء"),
    h(
      "button",
      {
        type: "button",
        class: "btn primary",
        onclick: () => {
          loop = { range, each, whole };
          m.close();
          void playFrom(range.start);
        },
      },
      icon("play"),
      "تشغيل",
    ),
  );
  const m = modal("تكرار مقطع", body, { footer });
}

// ---------- favourites, volume, tafsir ----------

function toggleFavorite() {
  const fav = isFavorite(view);
  const favorites: [number, number][] = fav
    ? S.ayah.favorites.filter(([a, b]) => !(a === view.start && b === view.end))
    : [[view.start, view.end], ...S.ayah.favorites];
  void update((s) => ({ ...s, ayah: { ...s.ayah, favorites } }));
  toast(fav ? "أُزيلت من المفضلة" : "أُضيفت إلى المفضلة");
}

/**
 * The favourite ayat in a window: the surahs down one side (with how many),
 * the chosen surah's ayat in the mushaf's script; tapping one shows it in the tab.
 */
export async function openFavorites() {
  const bySurah = new Map<number, [number, number][]>();
  for (const f of S.ayah.favorites) {
    const s = ayahAt(f[0]).s;
    bySurah.set(s, [...(bySurah.get(s) ?? []), f]);
  }
  const surahs = [...bySurah.keys()].sort((a, b) => a - b);
  let current = surahs[0];
  const side = h("nav", { class: "fav-surahs", "aria-label": "السور" });
  const main = h("div", { class: "fav-ayat" });
  const remove = async (start: number, end: number) => {
    await update((st) => ({ ...st, ayah: { ...st.ayah, favorites: st.ayah.favorites.filter(([a, b]) => !(a === start && b === end)) } }));
    const left = bySurah.get(current)!.filter(([a, b]) => !(a === start && b === end));
    if (left.length) bySurah.set(current, left);
    else {
      bySurah.delete(current);
      surahs.splice(surahs.indexOf(current), 1);
      current = surahs[0];
    }
    if (!surahs.length) return m.close();
    void draw();
  };
  const draw = async () => {
    fill(
      side,
      ...surahs.map((s) =>
        h("button", { type: "button", class: `fav-surah${s === current ? " on" : ""}`, onclick: () => ((current = s), void draw()) }, `${SURAHS[s - 1][0]} (${n(bySurah.get(s)!.length)})`),
      ),
    );
    const list = [...(bySurah.get(current) ?? [])].sort((a, b) => a[0] - b[0]);
    const views = await Promise.all(list.map(([start, end]) => ayatOf({ start, end })));
    await Promise.all([...new Set(views.flat().flatMap((a) => a.lines.map((l) => l[0])))].map((p) => loadPage(p).catch(() => undefined)));
    fill(
      main,
      ...list.map(([start, end], k) =>
        h(
          "div",
          { class: "fav-row" },
          h(
            "button",
            {
              type: "button",
              class: "fav-ayah",
              title: `اعرضها: ${rangeLabel({ start, end }, n)}`,
              onclick: () => {
                m.close();
                void go({ start, end });
              },
            },
            ...views[k].flatMap((a) => a.lines.map(([page, , codes]) => h("span", { style: `font-family: "${pageFamily(page)}"` }, [...codes].join("\u200B"), " "))),
          ),
          h("button", { type: "button", class: "round-btn small", title: "إزالة من المفضلة", "aria-label": "إزالة من المفضلة", onclick: () => void remove(start, end) }, icon("x")),
        ),
      ),
    );
  };
  const body = surahs.length ? h("div", { class: "fav-window" }, side, main) : h("p", { class: "muted empty" }, "اضغط القلب تحت أي آية لتظهر هنا.");
  const m = modal("الآيات المفضلة", body, { cls: "wide" });
  if (surahs.length) await draw();
}

function volumePop(anchor: HTMLElement) {
  const range = h("input", {
    type: "range",
    min: "0",
    max: "1",
    step: "0.05",
    value: String(S.ayah.volume),
    "aria-label": "مستوى صوت التلاوة",
    oninput: (e: Event) => {
      const v = Number((e.target as HTMLInputElement).value);
      if (audio) audio.volume = v;
    },
    onchange: (e: Event) => {
      const v = Number((e.target as HTMLInputElement).value);
      void update((s) => ({ ...s, ayah: { ...s.ayah, volume: v } }));
    },
  });
  popover(anchor, h("label", { class: "volume-pop" }, icon("volume-2"), range), "volume");
}

/** التفسير الميسر in a window: each ayah in the mushaf's script above its tafsir, in large type. */
async function openTafsir() {
  tafsir ??= await loadTafsir().catch(() => null);
  if (!tafsir) return toast("تعذّر تحميل التفسير");
  const body = h(
    "div",
    { class: "tafsir-window" },
    ...ayat.map((a) =>
      h(
        "article",
        { class: "tafsir-item" },
        h(
          "p",
          { class: "tafsir-ayah", lang: "ar" },
          ...a.lines.map(([page, , codes]) => h("span", { style: `font-family: "${pageFamily(page)}"` }, [...codes].join("​"), " ")),
        ),
        h("p", { class: "tafsir-text" }, tafsir![a.i] ?? ""),
      ),
    ),
    h("p", { class: "muted small" }, "التفسير الميسر — مجمع الملك فهد لطباعة المصحف الشريف"),
  );
  modal(`التفسير الميسر — ${rangeLabel(view, n)}`, body, { cls: "wide" });
}

// ---------- popovers ----------

function searchPop(anchor: HTMLElement) {
  const input = h("input", { class: "field", type: "search", name: "q", placeholder: "اكتب كلمة من آية", autocomplete: "off" });
  const form = h(
    "form",
    {
      class: "search-pop",
      onsubmit: (e: Event) => {
        e.preventDefault();
        const q = input.value.trim();
        if (q) openUrl(siteUrl(`/search?q=${encodeURIComponent(q)}`), S.dock.newTab);
      },
    },
    input,
    h("button", { class: "btn primary", type: "submit" }, icon("search"), "ابحث"),
  );
  popover(anchor, form);
  input.focus();
}

function reciterPop(anchor: HTMLElement) {
  popover(
    anchor,
    h(
      "div",
      { class: "menu-list" },
      ...AYAH_RECITERS.map((r) =>
        h(
          "button",
          {
            type: "button",
            class: `menu-item${r.id === S.reciter ? " on" : ""}`,
            onclick: () => {
              closePopover();
              const playing = audio ? onAir : -1;
              void update({ reciter: r.id }).then(() => {
                if (playing >= 0) void playFrom(playing);
              });
            },
          },
          r.name,
          r.id === S.reciter && icon("check"),
        ),
      ),
    ),
  );
}

function surahPop(anchor: HTMLElement) {
  const list = h("div", { class: "menu-list surah-list" });
  const current = ayahAt(view.start).s;
  const draw = (q: string) => {
    const f = foldArabic(q.trim());
    fill(
      list,
      ...SURAHS.map(([name, count, , start], k) => [name, count, start, k + 1] as const)
        .filter(([name, , , s]) => !f || foldArabic(name).includes(f) || String(s) === q.trim())
        .map(([name, count, start, s]) =>
          h(
            "button",
            {
              type: "button",
              class: `menu-item${s === current ? " on" : ""}`,
              onclick: () => {
                closePopover();
                void go({ start, end: start });
              },
            },
            h("span", { class: "num" }, n(s)),
            h("span", { class: "grow" }, name),
            h("span", { class: "muted" }, `${n(count)} آية`),
          ),
        ),
    );
  };
  const input = h("input", { class: "field", type: "search", placeholder: "ابحث عن سورة", oninput: (e: Event) => draw((e.target as HTMLInputElement).value) });
  draw("");
  popover(anchor, h("div", { class: "surah-pop" }, input, list));
  input.focus();
  list.querySelector(".on")?.scrollIntoView({ block: "center" });
}

function morePop(anchor: HTMLElement) {
  const fav = isFavorite(view);
  const item = (ic: string, label: string, onclick: () => void) =>
    h("button", { type: "button", class: "menu-item", onclick: () => (closePopover(), onclick()) }, icon(ic), h("span", { class: "grow" }, label));
  popover(
    anchor,
    h(
      "div",
      { class: "menu-list" },
      ...AYAH_ACTIONS.filter((a) => S.controls[a] === "more").map((a) => {
        const x = action(a, fav);
        return item(x.icon, x.label, () => x.run(anchor));
      }),
      item(S.tafsir ? "eye-off" : "eye", S.tafsir ? "إخفاء التفسير تحت الآية" : "التفسير تحت الآية", () => void update({ tafsir: !S.tafsir })),
      item("heart", "الآيات المفضلة", () => void openFavorites()),
      item("settings", "تخصيص الأزرار", () => openSettings("quran")),
    ),
  );
}
