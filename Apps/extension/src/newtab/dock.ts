/**
 * The shortcuts dock: the user's links and groups of links (and the browser's
 * most visited sites as a group of their own) on any edge of the screen, a
 * page of all of them, and an editor (add a link with its site's logo or a
 * picture, ready-made groups previewed before adding, drag links into and out
 * of groups, the dock's place and size, its settings button shown or not).
 */
import { $, fill, h, icon, modal, popover, toast } from "../lib/dom";
import {
  cleanUrl,
  isGroup,
  newId,
  PRESET_GROUPS,
  presetGroup,
  type DockGroup,
  type DockItem,
  type DockLink,
  type DockPosition,
  type DockSize,
} from "../lib/settings";
import { iconFor, resetIcons, serviceIcon, warmIcons } from "../lib/icons";
import { allowed } from "./browser";
import { S, update } from "./state";
import { openUrl, toggleRow } from "./ui";

const IN_DOCK = 10;
const ICONS_KEY = "dock.icons";
let topSites: DockLink[] | null = null;
/** Pictures the user chose for links, by link id (data: or https: URLs). */
let pictures: Record<string, string> = {};

const TOP_ID = "top-sites";
const APPS_ID = "apps";

async function loadPictures() {
  pictures = ((await chrome.storage.local.get(ICONS_KEY))[ICONS_KEY] as Record<string, string> | undefined) ?? {};
}

async function setPicture(id: string, src: string | null) {
  if (src) pictures[id] = src;
  else delete pictures[id];
  await chrome.storage.local.set({ [ICONS_KEY]: pictures });
}

function linkFace(l: DockLink) {
  const letter = h("span", { class: "tile-letter", "aria-hidden": "true" }, [...l.title][0]?.toUpperCase() ?? "");
  const own = (l.icon && pictures[l.id]) || l.appIcon;
  const img = h("img", { class: own ? "tile-icon custom" : "tile-icon", alt: "", loading: "lazy" });
  // The user's picture, else the site's icon (Chrome's own when it has one: see lib/icons.ts).
  img.src = own || iconFor(l.url, (better) => (img.src = better));
  img.addEventListener("error", () => img.replaceWith(letter));
  return img;
}

function tile(l: DockLink, cls = "tile") {
  return h(
    "a",
    {
      class: cls,
      href: l.url,
      title: l.title,
      onclick: (e: MouseEvent) => {
        if (l.app) {
          e.preventDefault();
          if (__BROWSER__ !== "firefox") void chrome.management.launchApp(l.app);
          return;
        }
        if (e.ctrlKey || e.metaKey || e.button !== 0) return;
        e.preventDefault();
        openUrl(l.url, S.dock.newTab);
      },
    },
    h("span", { class: "tile-face" }, linkFace(l)),
    h("span", { class: "tile-name" }, l.title),
  );
}

function groupTile(g: DockGroup) {
  const btn = h(
    "button",
    { type: "button", class: "tile", title: g.title, "aria-haspopup": "dialog" },
    h("span", { class: "tile-face group-face" }, ...g.links.slice(0, 4).map((l) => linkFace(l))),
    h("span", { class: "tile-name" }, g.title),
  );
  btn.addEventListener("click", () => popover(btn, groupPanel(g), "shortcuts-pop"));
  return btn;
}

const groupPanel = (g: DockGroup) =>
  h(
    "div",
    { class: "shortcuts-panel" },
    h("div", { class: "pop-title" }, g.title),
    g.links.length ? h("div", { class: "shortcut-grid" }, ...g.links.map((l) => tile(l, "tile tile-lg"))) : h("p", { class: "muted" }, "المجموعة فارغة."),
  );

/** The user's items, then «الأكثر زيارة» and the installed apps as groups when chosen (and allowed). */
async function items(): Promise<DockItem[]> {
  const out: DockItem[] = [...S.dock.items];
  if (S.dock.topGroup && typeof chrome.topSites?.get === "function") {
    topSites ??= (await chrome.topSites.get().catch(() => [])).slice(0, 12).map((t) => ({ id: t.url, title: t.title || new URL(t.url).hostname, url: t.url }));
    out.push({ id: TOP_ID, title: "الأكثر زيارة", links: topSites });
  }
  // Without the permission (taken back, or a copy of the settings from another computer) chrome.management has no getAll.
  if (S.dock.apps && typeof chrome.management?.getAll === "function") {
    const apps = await chrome.management
      .getAll()
      .then((all) => all.filter((a) => a.isApp && a.enabled))
      .catch(() => []);
    if (apps.length)
      out.push({
        id: APPS_ID,
        title: "التطبيقات",
        links: apps.map((a) => ({
          id: `app:${a.id}`,
          title: a.shortName || a.name,
          url: a.appLaunchUrl ?? a.homepageUrl ?? "",
          app: a.id,
          appIcon: a.icons?.slice().sort((x, y) => y.size - x.size)[0]?.url,
        })),
      });
  }
  return out;
}

export async function renderDock() {
  await Promise.all([loadPictures(), warmIcons()]);
  const dock = $("#dock");
  dock.className = `dock panel dock-${S.dock.position} dock-${S.dock.size}`;
  const list = await items();
  const grid = h("button", { class: "round-btn", type: "button", title: "كل الاختصارات", "aria-label": "كل الاختصارات" }, icon("layout-grid"));
  grid.addEventListener("click", () => popover(grid, allPanel(list), "shortcuts-pop"));
  const gear = h("button", { class: "round-btn", type: "button", title: "تعديل الاختصارات", "aria-label": "تعديل الاختصارات" }, icon("settings"));
  gear.addEventListener("click", openEditor);
  fill(
    dock,
    grid,
    h("span", { class: "dock-sep" }),
    // Items marked «داخل كل الاختصارات فقط» stay out of the bar.
    ...list
      .filter((i) => !i.hidden)
      .slice(0, IN_DOCK)
      .map((i) => (isGroup(i) ? groupTile(i) : tile(i))),
    S.dock.showGear && h("span", { class: "dock-sep" }),
    S.dock.showGear && gear,
  );
}

/** Every shortcut: the loose links and the groups (as folders to open, or laid out under their names). */
function allPanel(list: DockItem[]) {
  const body = h("div", { class: "shortcuts-panel" });
  const loose = list.filter((i): i is DockLink => !isGroup(i));
  const groups = list.filter(isGroup);
  const head = (title: string, back?: () => void) =>
    h(
      "div",
      { class: "pop-title row" },
      back && h("button", { type: "button", class: "round-btn small", title: "رجوع", "aria-label": "رجوع", onclick: back }, icon("chevron-right")),
      h("span", { class: "grow" }, title),
      h("button", { type: "button", class: "btn ghost", onclick: openEditor }, icon("settings"), "تعديل"),
    );
  const folder = (g: DockGroup) =>
    h(
      "button",
      { type: "button", class: "tile tile-lg", title: g.title, onclick: () => openFolder(g) },
      h("span", { class: "tile-face group-face" }, ...g.links.slice(0, 4).map((l) => linkFace(l))),
      h("span", { class: "tile-name" }, g.title),
    );
  const openFolder = (g: DockGroup) =>
    fill(body, head(g.title, drawAll), g.links.length ? h("div", { class: "shortcut-grid" }, ...g.links.map((l) => tile(l, "tile tile-lg"))) : h("p", { class: "muted" }, "المجموعة فارغة."));
  const drawAll = () =>
    fill(
      body,
      head("كل الاختصارات"),
      !list.length && h("p", { class: "muted" }, "لا توجد اختصارات بعد."),
      ...(S.dock.groupsAs === "folders"
        ? [h("div", { class: "shortcut-grid" }, ...groups.map(folder), ...loose.map((l) => tile(l, "tile tile-lg")))]
        : [
            loose.length > 0 && h("div", { class: "shortcut-grid" }, ...loose.map((l) => tile(l, "tile tile-lg"))),
            ...groups.map((g) => h("section", { class: "panel-group" }, h("div", { class: "pop-sub" }, g.title), h("div", { class: "shortcut-grid" }, ...g.links.map((l) => tile(l, "tile tile-lg"))))),
          ]),
    );
  drawAll();
  return body;
}

// ---------- the editor ----------

const POSITIONS: [DockPosition, string, string][] = [
  ["top", "فوق", "panel-top"],
  ["bottom", "تحت", "panel-bottom"],
  ["right", "يمين", "panel-right"],
  ["left", "شمال", "panel-left"],
];
const SIZES: [DockSize, string][] = [
  ["s", "صغير"],
  ["m", "متوسط"],
  ["l", "كبير"],
];

const dock = (patch: Partial<typeof S.dock>) => update((s) => ({ ...s, dock: { ...s.dock, ...patch } }));
const saveItems = (next: DockItem[]) => dock({ items: next });

/** Takes a link or group out of the list (wherever it is) and returns it. */
function take(list: DockItem[], id: string): DockItem | null {
  const i = list.findIndex((x) => x.id === id);
  if (i >= 0) return list.splice(i, 1)[0];
  for (const g of list.filter(isGroup)) {
    const j = g.links.findIndex((l) => l.id === id);
    if (j >= 0) return g.links.splice(j, 1)[0];
  }
  return null;
}

/** Moves an item before another (`before`), or to the end of a group / the top level. */
function move(id: string, target: { group: string | null; before?: string }) {
  if (id === target.before) return;
  const next: DockItem[] = structuredClone(S.dock.items);
  const item = take(next, id);
  if (!item) return;
  const into = target.group ? next.find((x): x is DockGroup => x.id === target.group && isGroup(x)) : null;
  if (target.group && (!into || isGroup(item))) return; // groups don't nest
  const list: DockItem[] = into ? into.links : next;
  const at = target.before ? list.findIndex((x) => x.id === target.before) : -1;
  list.splice(at >= 0 ? at : list.length, 0, item as DockLink);
  void saveItems(next);
}

let editor: { close: () => void } | null = null;
let editing: DockLink | null = null;

export function openEditor() {
  const body = h("div", { class: "dock-editor" });
  editor = modal("تعديل الاختصارات", body, { cls: "wide", onClose: () => ((editor = null), (editing = null)) });
  drawEditor(body);
}

/** Re-draws the open editor after a change (the dock re-renders through the state). */
export function refreshEditor() {
  const body = document.querySelector<HTMLElement>(".dock-editor");
  if (body) drawEditor(body);
}

function drawEditor(body: HTMLElement) {
  const seg = <T extends string>(choices: [T, string, string?][], value: T, set: (v: T) => void) =>
    h(
      "div",
      { class: `segmented n${choices.length}` },
      ...choices.map(([v, label, ic]) =>
        h("button", { type: "button", class: `seg${value === v ? " on" : ""}`, "aria-pressed": String(value === v), onclick: () => void set(v) }, ic && icon(ic), label),
      ),
    );
  fill(
    body,
    h(
      "section",
      { class: "set-section" },
      h("h3", null, "الشريط"),
      h(
        "div",
        { class: "set-box" },
        h("div", { class: "set-row" }, h("span", null, "المكان"), seg(POSITIONS, S.dock.position, (v) => dock({ position: v }))),
        h("div", { class: "set-row" }, h("span", null, "الحجم"), seg(SIZES, S.dock.size, (v) => dock({ size: v }))),
        toggleRow("فتح الروابط في تبويب جديد", S.dock.newTab, (v) => void dock({ newTab: v })),
        toggleRow("مجموعة «الأكثر زيارة»", S.dock.topGroup, (v) => void setTopGroup(v), "المواقع التي تزورها كثيرًا، مع اختصاراتك"),
        toggleRow("زر الإعدادات في الشريط", S.dock.showGear, (v) => void dock({ showGear: v }), "عند إخفائه تجده في «كل الاختصارات»"),
        __BROWSER__ !== "firefox" && toggleRow(`تطبيقات ${isEdgeName()} المثبّتة`, S.dock.apps, (v) => void setApps(v), "مجموعة بالتطبيقات (PWA) المثبّتة على المتصفح"),
        h(
          "div",
          { class: "set-row" },
          h("span", null, "المجموعات في «كل الاختصارات»"),
          seg(
            [
              ["folders", "مجمّعة في فولدرات", "folder"],
              ["open", "مفرودة", "layout-grid"],
            ] as ["folders" | "open", string, string][],
            S.dock.groupsAs,
            (v) => dock({ groupsAs: v }),
          ),
        ),
        h(
          "div",
          { class: "set-row" },
          h("span", null, "الأيقونات", h("small", null, "تتحدث تلقائيًا كل أسبوع، أو الآن")),
          h(
            "button",
            {
              type: "button",
              class: "btn",
              onclick: async () => {
                await resetIcons();
                await renderDock();
                refreshEditor();
                toast("جارٍ تحديث الأيقونات");
              },
            },
            icon("refresh-cw"),
            "تحديث الأيقونات",
          ),
        ),
      ),
    ),
    itemsSection(),
    linkForm(),
    groupsSection(),
  );
}

const isEdgeName = () => (__BROWSER__ === "edge" ? "Edge" : "Chrome");

async function setApps(on: boolean) {
  if (on && !(await allowed("management"))) return refreshEditor();
  await dock({ apps: on });
  // Granted just now: this page gets chrome.management.getAll only after a reload.
  if (on && typeof chrome.management?.getAll !== "function") location.reload();
}

async function setTopGroup(on: boolean) {
  if (on) {
    // Asked only when chosen (answered at once when already granted).
    const ok = await chrome.permissions.request({ permissions: ["topSites"] }).catch(() => false);
    if (!ok) {
      toast("لم يُسمح بقراءة المواقع الأكثر زيارة");
      return refreshEditor();
    }
  }
  topSites = null;
  await dock({ topGroup: on });
  if (on && typeof chrome.topSites?.get !== "function") location.reload();
}

/** In the bar, or only inside «كل الاختصارات». */
function barToggle(item: DockItem) {
  const shown = !item.hidden;
  return h(
    "button",
    {
      type: "button",
      class: `round-btn small${shown ? "" : " off-bar"}`,
      title: shown ? "ظاهر في الشريط — اضغط ليبقى داخل «كل الاختصارات» فقط" : "داخل «كل الاختصارات» فقط — اضغط لإظهاره في الشريط",
      "aria-pressed": String(shown),
      onclick: () => void saveItems(S.dock.items.map((x) => (x.id === item.id ? { ...x, hidden: shown } : x))),
    },
    icon(shown ? "eye" : "eye-off"),
  );
}

function itemsSection() {
  const drag = (id: string) => ({
    draggable: "true",
    ondragstart: (e: DragEvent) => {
      // A link inside a group: its group (also draggable) must not take over the drag.
      e.stopPropagation();
      e.dataTransfer!.setData("text/x-dock", id);
      e.dataTransfer!.effectAllowed = "move";
      (e.currentTarget as HTMLElement).classList.add("dragging");
    },
    ondragend: (e: DragEvent) => (e.currentTarget as HTMLElement).classList.remove("dragging"),
  });
  const dropOn = (target: { group: string | null; before?: string }) => ({
    ondragover: (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("text/x-dock")) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).classList.add("drop");
    },
    ondragleave: (e: DragEvent) => (e.currentTarget as HTMLElement).classList.remove("drop"),
    ondrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).classList.remove("drop");
      const id = e.dataTransfer?.getData("text/x-dock");
      if (id) move(id, target);
    },
  });
  const linkRow = (l: DockLink, group: string | null) =>
    h(
      "li",
      { class: "link-row", ...drag(l.id), ...dropOn({ group, before: l.id }) },
      icon("grip-vertical", "icon grip"),
      h("span", { class: "tile-face small" }, linkFace(l)),
      h("span", { class: "link-text" }, h("span", { class: "link-title" }, l.title), h("span", { class: "link-url", dir: "ltr" }, new URL(l.url).hostname)),
      group === null && barToggle(l),
      h("button", { type: "button", class: "round-btn small", title: "تعديل", "aria-label": `تعديل ${l.title}`, onclick: () => editLink(l) }, icon("pencil")),
      h("button", { type: "button", class: "round-btn small", title: "حذف", "aria-label": `حذف ${l.title}`, onclick: () => void removeItem(l.id) }, icon("x")),
    );
  const groupBox = (g: DockGroup) =>
    h(
      "li",
      { class: "group-box", ...drag(g.id), ...dropOn({ group: null, before: g.id }) },
      h(
        "div",
        { class: "group-head" },
        icon("grip-vertical", "icon grip"),
        icon("folder", "icon"),
        h("input", {
          class: "group-name",
          value: g.title,
          "aria-label": "اسم المجموعة",
          maxlength: "40",
          onchange: (e: Event) => {
            const title = (e.target as HTMLInputElement).value.trim() || "مجموعة";
            void saveItems(S.dock.items.map((x) => (x.id === g.id ? { ...x, title } : x)));
          },
        }),
        h("span", { class: "muted" }, `${g.links.length}`),
        barToggle(g),
        h("button", { type: "button", class: "round-btn small", title: "حذف المجموعة", "aria-label": `حذف ${g.title}`, onclick: () => void removeItem(g.id) }, icon("x")),
      ),
      h(
        "ul",
        { class: "group-links", ...dropOn({ group: g.id }) },
        ...g.links.map((l) => linkRow(l, g.id)),
        h("li", { class: "drop-hint" }, "اسحب رابطًا إلى هنا"),
      ),
    );
  return h(
    "section",
    { class: "set-section" },
    h("h3", null, "اختصاراتي ", h("small", null, "— اسحب الرابط لترتيبه أو لنقله إلى مجموعة أو خارجها")),
    h(
      "ul",
      { class: "dock-items", ...dropOn({ group: null }) },
      ...S.dock.items.map((i) => (isGroup(i) ? groupBox(i) : linkRow(i, null))),
      h("li", { class: "drop-hint" }, "اسحب إلى هنا لإخراج الرابط من المجموعة"),
    ),
  );
}

async function removeItem(id: string) {
  const next: DockItem[] = structuredClone(S.dock.items);
  const gone = take(next, id);
  if (gone && !isGroup(gone)) await setPicture(gone.id, null);
  if (gone && isGroup(gone)) for (const l of gone.links) await setPicture(l.id, null);
  await saveItems(next);
}

function editLink(l: DockLink) {
  editing = l;
  refreshEditor();
  document.querySelector<HTMLInputElement>(".link-form input[name=url]")?.focus();
}

/** Where a link lives (a group id or the top level). */
const groupOf = (id: string) => S.dock.items.find((x): x is DockGroup => isGroup(x) && x.links.some((l) => l.id === id))?.id ?? "";

function linkForm() {
  const l = editing;
  let picture: string | null | undefined = l?.icon ? pictures[l.id] : undefined;
  const title = h("input", { class: "field", name: "title", placeholder: "الاسم (اختياري)", maxlength: "40", value: l?.title ?? "" });
  const url = h("input", { class: "field", name: "url", placeholder: "https://example.com", dir: "ltr", required: true, value: l?.url ?? "", "aria-label": "الرابط" });
  const where = h(
    "select",
    { class: "field", "aria-label": "المجموعة" },
    h("option", { value: "" }, "بدون مجموعة"),
    ...S.dock.items.filter(isGroup).map((g) => h("option", { value: g.id }, g.title)),
  );
  where.value = l ? groupOf(l.id) : "";
  const preview = h("span", { class: "tile-face" });
  const note = h("span", { class: "muted" });
  const auto = h("button", { type: "button", class: "btn ghost", onclick: () => ((picture = undefined), drawPreview()) }, "الأيقونة التلقائية");
  const drawPreview = () => {
    const src = picture ?? (cleanUrl(url.value) ? serviceIcon(cleanUrl(url.value)!) : "");
    fill(preview, src ? h("img", { class: "tile-icon", src, alt: "" }) : icon("image"));
    note.textContent = picture ? "صورة من اختيارك" : "الأيقونة من الموقع تلقائيًا";
    auto.hidden = !picture;
  };
  url.addEventListener("input", () => picture === undefined && drawPreview());
  const file = h("input", {
    type: "file",
    accept: "image/*",
    hidden: true,
    onchange: async (e: Event) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      picture = await shrinkIcon(f).catch(() => null);
      if (!picture) toast("تعذّر فتح الصورة");
      drawPreview();
    },
  });
  drawPreview();
  const submit = async (e: Event) => {
    e.preventDefault();
    const clean = cleanUrl(url.value);
    if (!clean) {
      url.setCustomValidity("اكتب رابط موقع صحيحًا، مثل example.com");
      url.reportValidity();
      return;
    }
    const link: DockLink = { id: l?.id ?? newId(), title: title.value.trim().slice(0, 40) || new URL(clean).hostname.replace(/^www\./, ""), url: clean };
    if (picture) link.icon = true;
    await setPicture(link.id, picture ?? null);
    const next: DockItem[] = structuredClone(S.dock.items);
    if (l) take(next, l.id);
    const group = next.find((x): x is DockGroup => isGroup(x) && x.id === where.value);
    (group ? group.links : next).push(link);
    editing = null;
    await saveItems(next);
    toast(l ? "حُفظ الرابط" : "أُضيف الرابط");
  };
  url.addEventListener("input", () => url.setCustomValidity(""));
  return h(
    "section",
    { class: "set-section" },
    h("h3", null, l ? "تعديل الرابط" : "إضافة رابط"),
    h(
      "form",
      { class: "set-box link-form", onsubmit: submit, novalidate: true },
      h("div", { class: "form-grid" }, url, title, where),
      h(
        "div",
        { class: "icon-pick" },
        preview,
        note,
        h("button", { type: "button", class: "btn", onclick: () => file.click() }, icon("upload"), "اختيار صورة"),
        auto,
        file,
      ),
      h(
        "div",
        { class: "row end" },
        l && h("button", { type: "button", class: "btn ghost", onclick: () => ((editing = null), refreshEditor()) }, "إلغاء"),
        h("button", { type: "submit", class: "btn primary" }, icon(l ? "check" : "plus"), l ? "حفظ" : "إضافة"),
      ),
    ),
  );
}

function groupsSection() {
  const name = h("input", { class: "field", placeholder: "اسم المجموعة", maxlength: "40", "aria-label": "اسم المجموعة الجديدة" });
  return h(
    "section",
    { class: "set-section" },
    h("h3", null, "المجموعات"),
    h(
      "div",
      { class: "set-box" },
      h(
        "form",
        {
          class: "row add-group",
          onsubmit: (e: Event) => {
            e.preventDefault();
            const title = name.value.trim();
            if (!title) return name.focus();
            void saveItems([...S.dock.items, { id: newId(), title: title.slice(0, 40), links: [] }]);
          },
        },
        name,
        h("button", { type: "submit", class: "btn" }, icon("folder-plus"), "مجموعة جديدة"),
      ),
      h("div", { class: "pop-sub" }, "مجموعات جاهزة — اضغط لمعاينتها قبل الإضافة"),
      h("div", { class: "presets" }, ...PRESET_GROUPS.map((p, i) => presetCard(p, i))),
      preview != null && presetPreview(preview),
    ),
  );
}

/** The preset being previewed in the editor. */
let preview: number | null = null;
const logo = (title: string, url: string) => {
  const img = h("img", { class: "tile-icon", alt: "", src: serviceIcon(url), loading: "lazy" });
  img.addEventListener("error", () => img.replaceWith(h("span", { class: "tile-letter" }, [...title][0] ?? "")));
  return img;
};

function presetCard(p: (typeof PRESET_GROUPS)[number], i: number) {
  return h(
    "button",
    {
      type: "button",
      class: `preset${preview === i ? " on" : ""}`,
      "aria-expanded": String(preview === i),
      onclick: () => {
        preview = preview === i ? null : i;
        refreshEditor();
      },
    },
    h("span", { class: "preset-logos" }, ...p.links.slice(0, 5).map(([t, u]) => h("span", { class: "tile-face small" }, logo(t, u)))),
    h("span", { class: "preset-title" }, p.title),
    h("span", { class: "muted" }, `${p.links.length} روابط`),
  );
}

/** Every link of a preset with its logo, each can be left out, then «إضافة». */
function presetPreview(i: number) {
  const p = PRESET_GROUPS[i];
  const boxes = p.links.map(() => h("input", { type: "checkbox", checked: true }));
  return h(
    "div",
    { class: "preset-preview" },
    h(
      "div",
      { class: "preset-links" },
      ...p.links.map(([t, u], k) => h("label", { class: "preset-link" }, boxes[k], h("span", { class: "tile-face small" }, logo(t, u)), h("span", null, t))),
    ),
    h(
      "div",
      { class: "row end" },
      h("button", { type: "button", class: "btn ghost", onclick: () => ((preview = null), refreshEditor()) }, "إغلاق"),
      h(
        "button",
        {
          type: "button",
          class: "btn primary",
          onclick: () => {
            const group = presetGroup(i);
            group.links = group.links.filter((_, k) => boxes[k].checked);
            if (!group.links.length) return toast("اختر رابطًا واحدًا على الأقل");
            preview = null;
            void saveItems([...S.dock.items, group]);
            toast(`أُضيفت مجموعة «${p.title}»`);
          },
        },
        icon("plus"),
        "إضافة المجموعة",
      ),
    ),
  );
}

/** A chosen picture, squared and shrunk to 96 px (kept in extension storage). */
async function shrinkIcon(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 96, 96);
  return c.toDataURL("image/png");
}

export const editorOpen = () => !!editor;
