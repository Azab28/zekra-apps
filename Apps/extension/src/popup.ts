/**
 * The toolbar popup: the next prayer and the player — live stations, recorded
 * recitations by reciter (resumed where they were left), favourites and what
 * was played last, surahs suggested for the time, today's listening wird and a
 * sleep timer.
 */
import { foldArabic } from "../../../src/lib/fold-arabic";
import { $, applyTheme, fill, h, icon, siteUrl } from "./lib/dom";
import {
  BAQARAH_KEY,
  clock,
  loadRecent,
  loadResume,
  loadWird,
  RECENT_KEY,
  RESUME_KEY,
  resumeKey,
  suggestions,
  surahTitle,
  WIRD_KEY,
  wirdProgress,
  type Resume,
  type Wird,
} from "./lib/listen";
import { SURAHS } from "./lib/quran";
import {
  nowPlaying,
  onRadioChange,
  POS_KEY,
  radioState,
  sameTrack,
  sendRadio,
  STATIONS,
  stationById,
  trackLabel,
  type RadioPos,
  type RadioState,
  type Track,
} from "./lib/radio";
import { moshafById, moshafLabel, RECITERS, reciterById } from "./lib/reciters";
import { loadSettings, saveSettings, type Settings } from "./lib/settings";
import { countdown, formatTime, n, nextPrayer, prayerLabel } from "./lib/times";

type Tab = "fav" | "reciter" | "program" | "recite";
const TABS: [Tab, string][] = [
  ["fav", "المفضلة"],
  ["reciter", "بث القرّاء"],
  ["program", "برامج"],
  ["recite", "تلاوات"],
];
const SLEEP_CHOICES: [number | "surah", string][] = [
  [15, "١٥ د"],
  [30, "٣٠ د"],
  [60, "ساعة"],
  ["surah", "نهاية السورة"],
];

let S: Settings;
let R: RadioState;
let pos: RadioPos | null = null;
let recent: Track[] = [];
let resume: Resume = {};
let wird: Wird;
let baqarahAt: number | null = null;
let tab: Tab = "reciter";
/** The recitation reciter whose surahs are open, and which of their recitations. */
let reciterView: number | null = null;
let moshafPick: number | null = null;
let query = "";
let liveTitle: { id: number; text: string | null } | null = null;
let sleepOpen = false;
let seeking = false;

// ---------- header ----------

function renderNext() {
  const box = $("#next");
  if (!S.place) {
    fill(box, h("a", { href: "#", onclick: (e: Event) => openTab(e) }, "اختر مدينتك لمواقيت الصلاة"));
    return;
  }
  const next = nextPrayer(S.place);
  box.textContent = `${prayerLabel(next.prayer)} ${formatTime(next.at, S.place.timezone, S.clock24)} — بعد ${countdown(next.at.getTime() - Date.now())}`;
}

function openTab(e?: Event, hash = "") {
  e?.preventDefault();
  void chrome.tabs.create({ url: chrome.runtime.getURL(`newtab.html${hash}`) });
  window.close();
}

// ---------- the player ----------

const playing = () => !!R.track && R.status !== "stopped";

/** Play again what was last playing (the wird goes on from where it stopped). */
function replay(t: Track) {
  void sendRadio(t.kind === "wird" ? { type: "radio:wird" } : { type: "radio:play", track: t });
}

function statusText(t: Track): string {
  if (R.status === "loading") return "جارٍ التحميل…";
  if (R.status === "error") return "تعذّر التشغيل، جرّب مرة أخرى";
  if (R.status === "stopped") return "متوقف";
  if (t.kind === "live") return (liveTitle?.id === t.id && liveTitle.text) || "بث مباشر";
  return trackLabel(t)[1];
}

function sleepText(): string | null {
  const sl = R.sleep;
  if (!sl || !playing()) return null;
  return "at" in sl ? `يتوقف بعد ${countdown(sl.at - Date.now())}` : "يتوقف بنهاية السورة";
}

function renderPlayer() {
  const box = $("#player");
  const t = R.track;
  if (!t) {
    fill(box, h("div", { class: "player-empty muted" }, icon("radio-tower"), "اختر إذاعة أو تلاوة من القائمة."));
    return;
  }
  const on = playing();
  const [title] = trackLabel(t);
  const sleep = sleepText();
  fill(
    box,
    h(
      "div",
      { class: "player-row" },
      h(
        "button",
        { class: `btn play${on ? " on" : ""}`, "aria-label": on ? "إيقاف" : "تشغيل", onclick: () => (on ? void sendRadio({ type: "radio:stop" }) : replay(t)) },
        R.status === "loading" ? icon("loader-circle", "icon spin") : icon(on ? "square" : "play"),
      ),
      h("div", { class: "player-text" }, h("strong", null, title), h("span", { class: `muted${R.status === "error" ? " error" : ""}` }, statusText(t))),
      on &&
        h(
          "button",
          {
            class: `btn ghost icon-btn${R.sleep ? " lit" : ""}${sleepOpen ? " open" : ""}`,
            title: "مؤقت الإيقاف",
            "aria-label": "مؤقت الإيقاف",
            "aria-expanded": String(sleepOpen),
            onclick: () => {
              sleepOpen = !sleepOpen;
              renderPlayer();
            },
          },
          icon("timer"),
        ),
      h(
        "label",
        { class: "volume", title: "مستوى الصوت" },
        icon(R.volume === 0 ? "volume-x" : "volume-2"),
        h("input", {
          type: "range",
          min: "0",
          max: "1",
          step: "0.05",
          value: String(R.volume),
          "aria-label": "مستوى الصوت",
          oninput: (e: Event) => void sendRadio({ type: "radio:volume", volume: Number((e.target as HTMLInputElement).value) }),
        }),
      ),
    ),
    t.kind !== "live" && progressRow(t),
    on && sleepOpen && sleepRow(),
    sleep &&
      !sleepOpen &&
      h(
        "div",
        { class: "sleep-line muted" },
        icon("timer"),
        h("span", { id: "sleep-text" }, sleep),
        h("button", { class: "link-btn", onclick: () => void sendRadio({ type: "radio:sleep", minutes: 0 }) }, "إلغاء"),
      ),
  );
}

function progressRow(t: Track) {
  if (t.kind === "wird") {
    const p = wirdProgress({ ...wird, pos: t.ayah });
    return h(
      "div",
      { class: "progress" },
      h("span", { class: "muted" }, `${n(Math.round(p.part * 100))}٪ من الجزء`),
      h("div", { class: "bar", role: "progressbar", "aria-valuenow": String(Math.round(p.part * 100)) }, h("i", { style: `inline-size:${p.part * 100}%` })),
    );
  }
  const [time, duration] = posNow();
  return h(
    "div",
    { class: "progress" },
    h("button", { class: "btn ghost icon-btn small", title: "السورة السابقة", "aria-label": "السورة السابقة", onclick: () => void sendRadio({ type: "radio:skip", dir: -1 }) }, icon("skip-forward")),
    h("span", { class: "muted time", id: "pos-time" }, clock(time)),
    h("input", {
      id: "pos-range",
      type: "range",
      min: "0",
      max: String(Math.max(1, Math.floor(duration))),
      step: "1",
      value: String(Math.floor(time)),
      "aria-label": "موضع التلاوة",
      disabled: !duration,
      oninput: (e: Event) => {
        seeking = true;
        $("#pos-time").textContent = clock(Number((e.target as HTMLInputElement).value));
      },
      onchange: (e: Event) => {
        seeking = false;
        const v = Number((e.target as HTMLInputElement).value);
        if (pos) pos = { ...pos, time: v, at: Date.now() };
        void sendRadio({ type: "radio:seek", time: v });
      },
    }),
    h("span", { class: "muted time" }, duration ? clock(duration) : "—"),
    h("button", { class: "btn ghost icon-btn small", title: "السورة التالية", "aria-label": "السورة التالية", onclick: () => void sendRadio({ type: "radio:skip", dir: 1 }) }, icon("skip-back")),
  );
}

/** Where the recording is now: the last report moved on by the time since. */
function posNow(): [number, number] {
  if (!pos) return [0, 0];
  const moved = R.status === "playing" ? (Date.now() - pos.at) / 1000 : 0;
  return [Math.min(pos.time + moved, pos.duration || Infinity), pos.duration];
}

function tickProgress() {
  const range = document.querySelector<HTMLInputElement>("#pos-range");
  if (range && !seeking) {
    const [time, duration] = posNow();
    range.value = String(Math.floor(time));
    if (duration && range.max !== String(Math.floor(duration))) return renderPlayer();
    $("#pos-time").textContent = clock(time);
  }
  const s = document.querySelector("#sleep-text");
  const text = sleepText();
  if (s && text) s.textContent = text;
}

function sleepRow() {
  return h(
    "div",
    { class: "sleep-row" },
    ...SLEEP_CHOICES.map(([m, label]) =>
      h(
        "button",
        {
          class: "pill",
          onclick: () => {
            sleepOpen = false;
            void sendRadio({ type: "radio:sleep", minutes: m });
          },
        },
        label,
      ),
    ),
    R.sleep &&
      h(
        "button",
        {
          class: "pill",
          onclick: () => {
            sleepOpen = false;
            void sendRadio({ type: "radio:sleep", minutes: 0 });
          },
        },
        "إلغاء المؤقت",
      ),
  );
}

// ---------- suggestions and the wird ----------

function renderSuggest() {
  const chips: HTMLElement[] = [];
  if (S.listen.wird.on) {
    const p = wirdProgress(wird);
    const now = R.track?.kind === "wird" && playing();
    chips.push(
      h(
        "button",
        { class: `suggest-chip wird${now ? " on" : ""}`, onclick: () => void sendRadio(now ? { type: "radio:stop" } : { type: "radio:wird" }), title: "ورد الاستماع: جزء كل يوم" },
        icon(p.done ? "book-check" : "headphones"),
        h(
          "span",
          null,
          h("b", null, p.done ? "أتممت ورد اليوم" : `ورد اليوم: الجزء ${n(p.juz)}`),
          h("small", null, p.done ? `التالي: الجزء ${n(p.juz)}` : `${n(Math.round(p.part * 100))}٪ — الختمة ${n(Math.round(p.whole * 100))}٪`),
        ),
      ),
    );
  }
  if (S.listen.suggest) {
    for (const sg of suggestions(S, baqarahAt)) {
      const track: Track = { kind: "surah", moshaf: S.listen.moshaf, surah: sg.surah };
      chips.push(
        h(
          "button",
          { class: "suggest-chip", onclick: () => void sendRadio({ type: "radio:play", track }), title: `${surahTitle(sg.surah)} — ${moshafLabel(S.listen.moshaf)}` },
          icon("play"),
          h("span", null, h("b", null, surahTitle(sg.surah)), h("small", null, sg.why)),
        ),
      );
    }
  }
  const box = $("#suggest");
  box.hidden = !chips.length;
  fill(box, ...chips);
}

// ---------- the lists ----------

function renderTabs() {
  fill(
    $("#tabs"),
    ...TABS.map(([id, label]) =>
      h(
        "button",
        {
          class: `tab${tab === id ? " on" : ""}`,
          role: "tab",
          "aria-selected": String(tab === id),
          onclick: () => {
            tab = id;
            if (id !== "recite") reciterView = null;
            renderTabs();
            renderList();
          },
        },
        label,
      ),
    ),
  );
  const filter = $<HTMLInputElement>("#filter");
  filter.placeholder = tab === "recite" ? (reciterView ? "ابحث عن سورة" : "ابحث عن قارئ") : tab === "fav" ? "ابحث في المفضلة" : "ابحث عن إذاعة";
}

const matches = (text: string) => !query || foldArabic(text).includes(foldArabic(query));

async function toggleFav(kind: "stations" | "reciters", id: number) {
  S = await loadSettings();
  const list = S.listen[kind];
  S.listen[kind] = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  await saveSettings(S);
  renderList();
}

function star(kind: "stations" | "reciters", id: number, name: string) {
  const on = S.listen[kind].includes(id);
  return h(
    "button",
    { class: `star${on ? " on" : ""}`, title: on ? "إزالة من المفضلة" : "إضافة إلى المفضلة", "aria-label": `${on ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}: ${name}`, "aria-pressed": String(on), onclick: () => void toggleFav(kind, id) },
    icon("star"),
  );
}

/** A row: the main button (play or open) and, beside it, a star. */
function row(opts: { label: string; sub?: string | null; current?: boolean; onclick: () => void; trail?: Node | false; side?: Node | false; lead?: Node | false }) {
  return h(
    "li",
    { class: "row" },
    h(
      "button",
      { class: `station${opts.current ? " current" : ""}`, "aria-current": opts.current ? "true" : null, onclick: opts.onclick },
      opts.lead,
      h("span", { class: "name" }, opts.label, opts.sub && h("small", { class: "muted" }, opts.sub)),
      opts.trail,
    ),
    opts.side,
  );
}

function playIcon(current: boolean) {
  if (!current) return icon("play", "icon hover-only");
  return R.status === "loading" ? icon("loader-circle", "icon spin") : icon("square");
}

function stationRow(id: number) {
  const s = stationById(id);
  if (!s) return null;
  const current = R.track?.kind === "live" && R.track.id === id && playing();
  return row({
    label: s.name,
    current,
    onclick: () => void sendRadio(current ? { type: "radio:stop" } : { type: "radio:play", track: { kind: "live", id } }),
    trail: playIcon(current),
    side: star("stations", id, s.name),
  });
}

function trackRow(t: Track) {
  if (t.kind === "live") return stationRow(t.id);
  if (t.kind !== "surah" || !moshafById(t.moshaf)) return null;
  const current = sameTrack(R.track, t) && playing();
  const [title, by] = trackLabel(t);
  return row({ label: title, sub: by, current, onclick: () => void sendRadio(current ? { type: "radio:stop" } : { type: "radio:play", track: t }), trail: playIcon(current) });
}

function reciterRow(id: number) {
  const r = reciterById(id);
  if (!r) return null;
  const current = R.track?.kind === "surah" && r.moshaf.some((m) => m.id === (R.track as { moshaf: number }).moshaf) && playing();
  return row({
    label: r.name,
    sub: r.moshaf.length > 1 ? `${n(r.moshaf.length)} روايات` : null,
    current,
    onclick: () => openReciter(id),
    trail: icon("chevron-left", "icon muted"),
    side: star("reciters", id, r.name),
  });
}

function openReciter(id: number) {
  tab = "recite";
  reciterView = id;
  const r = reciterById(id)!;
  const t = R.track;
  moshafPick = t?.kind === "surah" && r.moshaf.some((m) => m.id === t.moshaf) ? t.moshaf : (r.moshaf.find((m) => m.surahs.length === 114) ?? r.moshaf[0]).id;
  query = "";
  $<HTMLInputElement>("#filter").value = "";
  renderTabs();
  renderList();
  $("#stations").scrollTop = 0;
  document.querySelector(".station.current")?.scrollIntoView({ block: "center" });
}

function listOf(items: (HTMLElement | null)[], empty: string): HTMLElement[] {
  const got = items.filter((x): x is HTMLElement => !!x);
  return got.length ? got : [h("li", { class: "none muted" }, empty)];
}

function renderList() {
  const ul = $("#stations");
  if (tab === "fav") {
    const favStations = S.listen.stations.filter((id) => matches(stationById(id)?.name ?? ""));
    const favReciters = S.listen.reciters.filter((id) => matches(reciterById(id)?.name ?? ""));
    const last = recent.filter((t) => matches(trackLabel(t).join(" ")));
    if (!favStations.length && !favReciters.length && !last.length) {
      fill(ul, h("li", { class: "none muted" }, query ? "لا توجد نتائج" : "اضغط على النجمة بجانب أي إذاعة أو قارئ ليظهر هنا، ومعه آخر ما استمعت إليه."));
      return;
    }
    fill(
      ul,
      last.length > 0 && h("li", { class: "list-head" }, "آخر ما استمعت إليه"),
      ...last.map(trackRow),
      favStations.length > 0 && h("li", { class: "list-head" }, "إذاعات مفضلة"),
      ...favStations.map(stationRow),
      favReciters.length > 0 && h("li", { class: "list-head" }, "قرّاء مفضلون"),
      ...favReciters.map(reciterRow),
    );
    return;
  }
  if (tab === "reciter" || tab === "program") {
    // Favourites first.
    const list = STATIONS.filter((s) => s.group === tab && matches(s.name)).sort((a, b) => Number(S.listen.stations.includes(b.id)) - Number(S.listen.stations.includes(a.id)));
    fill(ul, ...listOf(list.map((s) => stationRow(s.id)), "لا توجد نتائج"));
    return;
  }
  if (reciterView == null) {
    const list = RECITERS.filter((r) => matches(r.name)).sort((a, b) => Number(S.listen.reciters.includes(b.id)) - Number(S.listen.reciters.includes(a.id)));
    fill(ul, ...listOf(list.map((r) => reciterRow(r.id)), "لا توجد نتائج"));
    return;
  }
  renderSurahs(ul);
}

function renderSurahs(ul: HTMLElement) {
  const r = reciterById(reciterView!)!;
  const m = r.moshaf.find((x) => x.id === moshafPick) ?? r.moshaf[0];
  const head = h(
    "li",
    { class: "reciter-head" },
    h(
      "button",
      {
        class: "btn ghost icon-btn small",
        title: "كل القرّاء",
        "aria-label": "كل القرّاء",
        onclick: () => {
          reciterView = null;
          query = "";
          $<HTMLInputElement>("#filter").value = "";
          renderTabs();
          renderList();
        },
      },
      icon("arrow-right"),
    ),
    h("strong", null, r.name),
    star("reciters", r.id, r.name),
  );
  const pick =
    r.moshaf.length > 1 &&
    h(
      "li",
      { class: "moshaf-pick" },
      (() => {
        const sel = h(
          "select",
          {
            class: "field",
            "aria-label": "الرواية",
            onchange: (e: Event) => {
              moshafPick = Number((e.target as HTMLSelectElement).value);
              renderList();
            },
          },
          ...r.moshaf.map((x) => h("option", { value: String(x.id) }, x.name)),
        );
        sel.value = String(m.id);
        return sel;
      })(),
    );
  const rows = m.surahs
    .filter((s) => matches(SURAHS[s - 1][0]) || query.trim() === String(s))
    .map((s) => {
      const track: Track = { kind: "surah", moshaf: m.id, surah: s };
      const current = sameTrack(R.track, track) && playing();
      const at = resume[resumeKey(m.id, s)];
      return row({
        label: SURAHS[s - 1][0],
        sub: !current && at ? `تكمل من ${clock(at)}` : null,
        current,
        lead: h("span", { class: "num muted" }, n(s)),
        onclick: () => void sendRadio(current ? { type: "radio:stop" } : { type: "radio:play", track }),
        trail: playIcon(current),
      });
    });
  fill(ul, head, pick, ...listOf(rows, "لا توجد نتائج"));
}

// ---------- start ----------

/** What the live station is on, refreshed while the popup is open. */
async function refreshLive() {
  const t = R.track;
  if (t?.kind !== "live" || R.status !== "playing") return;
  const text = await nowPlaying(t.id);
  liveTitle = { id: t.id, text };
  if (sameTrack(R.track, t)) renderPlayer();
}

async function main() {
  const got = await chrome.storage.local.get([POS_KEY, BAQARAH_KEY]);
  [S, R, recent, resume, wird] = await Promise.all([loadSettings(), radioState(), loadRecent(), loadResume(), loadWird()]);
  pos = (got[POS_KEY] as RadioPos | undefined) ?? null;
  baqarahAt = (got[BAQARAH_KEY] as number | undefined) ?? null;
  applyTheme(S.theme);

  // Open on what's playing; else the favourites when there are any.
  const t = R.track;
  if (t?.kind === "live") tab = stationById(t.id)?.group ?? "reciter";
  else if (t?.kind === "surah" && moshafById(t.moshaf)) {
    tab = "recite";
    reciterView = moshafById(t.moshaf)!.reciter.id;
    moshafPick = t.moshaf;
  } else if (S.listen.stations.length || S.listen.reciters.length || recent.length) tab = "fav";

  fill($("#open-tab"), icon("external-link"));
  $("#open-tab").addEventListener("click", (e) => openTab(e));
  fill($("#open-settings"), icon("settings"));
  $("#open-settings").addEventListener("click", (e) => openTab(e, "#settings-listen"));
  $<HTMLInputElement>("#filter").addEventListener("input", (e) => {
    query = (e.target as HTMLInputElement).value.trim();
    renderList();
  });
  renderNext();
  renderPlayer();
  renderSuggest();
  renderTabs();
  renderList();
  document.querySelector(".station.current")?.scrollIntoView({ block: "center" });

  onRadioChange((next) => {
    const started = next.status === "playing" && (R.status !== "playing" || !sameTrack(next.track, R.track));
    if (!sameTrack(next.track, R.track) || next.status === "stopped") sleepOpen = false;
    R = next;
    renderPlayer();
    renderSuggest();
    renderList();
    if (started) void refreshLive();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[POS_KEY]) {
      pos = (changes[POS_KEY].newValue as RadioPos | undefined) ?? null;
      tickProgress();
    }
    if (changes[RECENT_KEY]) recent = (changes[RECENT_KEY].newValue as Track[] | undefined) ?? [];
    if (changes[RESUME_KEY]) resume = (changes[RESUME_KEY].newValue as Resume | undefined) ?? {};
    if (changes[BAQARAH_KEY]) baqarahAt = (changes[BAQARAH_KEY].newValue as number | undefined) ?? null;
    if (changes[WIRD_KEY]) void loadWird().then((w) => ((wird = w), renderSuggest()));
    // The resume points change every few seconds while a surah plays: only redraw for the others.
    if (changes[RECENT_KEY] || changes[BAQARAH_KEY]) {
      renderSuggest();
      renderList();
    }
  });
  void refreshLive();
  setInterval(() => void refreshLive(), 30_000);
  setInterval(renderNext, 20_000);
  setInterval(tickProgress, 1000);
  document.body.append(
    h("a", { class: "foot muted", href: siteUrl("/radio"), target: "_blank" }, "الإذاعات والتلاوات على موقع ذِكرى", icon("external-link")),
  );
}

void main();
