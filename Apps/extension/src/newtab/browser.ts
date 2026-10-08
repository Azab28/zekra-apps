/**
 * The browser's own things in side panels: bookmarks, history, extensions and
 * installed apps (PWAs). Each needs an optional permission, asked the first
 * time its icon is clicked (the request must come straight from the click).
 */
import { confirmDialog, fill, h, icon, modal, toast } from "../lib/dom";
import { chromeIcon } from "../lib/icons";
import { S } from "./state";
import { openUrl } from "./ui";

type Perm = "bookmarks" | "history" | "management";

/** Whether this page has the permission's functions (`chrome.management` exists without it, for getSelf). */
const READY: Record<Perm, () => boolean> = {
  bookmarks: () => typeof chrome.bookmarks?.getTree === "function",
  history: () => typeof chrome.history?.search === "function",
  management: () => typeof chrome.management?.getAll === "function",
};

/**
 * Asks for the permission inside the click that called it; Chrome answers at
 * once without a prompt when it's already granted. A page open when it was
 * granted gets the API only once reloaded: with `reopen`, the page reloads to
 * that hash (newtab.ts opens the panel again, `again`: checked, not asked).
 */
export async function allowed(perm: Perm, reopen?: string, again = false): Promise<boolean> {
  const ok = again
    ? await chrome.permissions.contains({ permissions: [perm] }).catch(() => false)
    : await chrome.permissions.request({ permissions: [perm] }).catch(() => false);
  if (!ok) {
    if (!again) toast("لم يُمنح الإذن، يمكنك السماح به لاحقًا");
    return false;
  }
  if (READY[perm]()) return true;
  // Reloaded and still missing: nothing more to try. No `reopen`: the caller reloads itself.
  if (again || !reopen) return !again;
  location.hash = reopen;
  location.reload();
  return false;
}

const isEdge = () => __BROWSER__ === "edge";
export const browserName = () => ({ chrome: "Chrome", edge: "Edge", firefox: "Firefox" })[__BROWSER__];
/** Tools Firefox doesn't allow (an add-on can't manage others there, and it has no installed web apps). */
export const BROWSER_TOOLS = (t: string) => __BROWSER__ !== "firefox" || (t !== "extensions" && t !== "apps");

/** `lead`: shown before the icon (the visit time in history). Icons from the browser itself: bookmarks and history never leave the computer. */
function siteRow(title: string, url: string, lead?: Node | null, onRemove?: () => void) {
  // Firefox has no favicon API for extensions: a plain link icon (the addresses are never sent out for one).
  const img = __BROWSER__ === "firefox" ? icon("link") : h("img", { class: "tile-icon", alt: "", src: chromeIcon(url, 32), loading: "lazy" });
  img.addEventListener("error", () => img.replaceWith(icon("link")));
  return h(
    "li",
    { class: "site-row" },
    h(
      "a",
      {
        href: url,
        class: "site-link",
        title: url,
        onclick: (e: MouseEvent) => {
          if (e.ctrlKey || e.metaKey || e.button !== 0) return;
          e.preventDefault();
          openUrl(url, S.dock.newTab);
        },
      },
      lead,
      img,
      h("span", { class: "site-text" }, h("span", { class: "site-title" }, title || url), h("span", { class: "site-url", dir: "ltr" }, hostOf(url))),
    ),
    onRemove && h("button", { type: "button", class: "round-btn small", title: "حذف", "aria-label": `حذف ${title}`, onclick: onRemove }, icon("x")),
  );
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// ---------- bookmarks ----------

export async function openBookmarks(again = false) {
  if (!(await allowed("bookmarks", "#bookmarks", again))) return;
  const body = h("div", { class: "browser-panel" });
  modal("الإشارات المرجعية", body, { cls: "drawer" });
  const list = h("div", { class: "bm-tree" });
  const search = h("input", {
    class: "field",
    type: "search",
    placeholder: "ابحث في الإشارات",
    oninput: (e: Event) => void draw((e.target as HTMLInputElement).value),
  });
  fill(body, search, list);
  const draw = async (q = "") => {
    if (q.trim()) {
      const found = (await chrome.bookmarks.search(q.trim())).filter((b) => b.url).slice(0, 200);
      fill(list, found.length ? h("ul", { class: "site-list" }, ...found.map((b) => siteRow(b.title, b.url!))) : h("p", { class: "muted" }, "لا نتائج."));
      return;
    }
    const [root] = await chrome.bookmarks.getTree();
    fill(list, ...(root.children ?? []).map((n, i) => folder(n, i === 0)));
  };
  const folder = (node: chrome.bookmarks.BookmarkTreeNode, open: boolean): HTMLElement => {
    const links = (node.children ?? []).filter((c) => c.url);
    const subs = (node.children ?? []).filter((c) => !c.url);
    const remove = (b: chrome.bookmarks.BookmarkTreeNode) => async () => {
      if (!(await confirmDialog(`حذف «${b.title}» من الإشارات؟`, { ok: "حذف", danger: true }))) return;
      await chrome.bookmarks.remove(b.id);
      void draw();
    };
    return h(
      "details",
      { class: "bm-folder", open },
      h("summary", null, icon("folder"), h("span", { class: "grow" }, node.title || "إشارات"), h("span", { class: "muted small" }, String(links.length))),
      subs.length > 0 && h("div", { class: "bm-subs" }, ...subs.map((s) => folder(s, false))),
      links.length > 0 && h("ul", { class: "site-list" }, ...links.map((b) => siteRow(b.title, b.url!, null, remove(b)))),
    );
  };
  void draw();
  search.focus();
}

// ---------- history ----------

export async function openHistory(again = false) {
  if (!(await allowed("history", "#history", again))) return;
  const body = h("div", { class: "browser-panel" });
  modal("السجل", body, { cls: "drawer" });
  const list = h("div", { class: "history" });
  const search = h("input", { class: "field", type: "search", placeholder: "ابحث في السجل", oninput: (e: Event) => void draw((e.target as HTMLInputElement).value) });
  fill(body, search, list);
  const dayName = (ms: number) => {
    const d = new Date(ms);
    const today = new Date();
    const y = new Date(today.getTime() - 86_400_000);
    if (d.toDateString() === today.toDateString()) return "اليوم";
    if (d.toDateString() === y.toDateString()) return "أمس";
    return new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long" }).format(d);
  };
  /** «٤:٣٥» over «م», in a column of its own. */
  const visitTime = (ms: number) => {
    const parts = new Intl.DateTimeFormat("ar-EG", { hour: "numeric", minute: "2-digit" }).formatToParts(ms);
    const clock = parts.filter((p) => p.type !== "dayPeriod").map((p) => p.value).join("").trim();
    const period = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
    return h("span", { class: "visit-time" }, h("span", null, clock), h("small", null, period));
  };
  const draw = async (q = "") => {
    const items = await chrome.history.search({ text: q.trim(), startTime: Date.now() - 30 * 86_400_000, maxResults: 300 });
    const byDay = new Map<string, chrome.history.HistoryItem[]>();
    for (const it of items) {
      const k = dayName(it.lastVisitTime ?? 0);
      byDay.set(k, [...(byDay.get(k) ?? []), it]);
    }
    fill(
      list,
      !items.length && h("p", { class: "muted" }, "لا نتائج."),
      ...[...byDay].map(([day, its]) =>
        h(
          "section",
          { class: "history-day" },
          h("div", { class: "pop-sub" }, day),
          h(
            "ul",
            { class: "site-list" },
            ...its.map((it) =>
              siteRow(it.title ?? "", it.url!, visitTime(it.lastVisitTime ?? 0), async () => {
                await chrome.history.deleteUrl({ url: it.url! });
                void draw(search.value);
              }),
            ),
          ),
        ),
      ),
    );
  };
  void draw();
  search.focus();
}

// ---------- extensions ----------

const bestIcon = (icons?: chrome.management.IconInfo[]) => icons?.slice().sort((a, b) => b.size - a.size)[0]?.url;

export async function openExtensions(again = false) {
  // Firefox lets no add-on manage the others (the tool is hidden there).
  if (__BROWSER__ === "firefox") return;
  if (!(await allowed("management", "#extensions", again))) return;
  const body = h("div", { class: "browser-panel" });
  modal("إدارة الإضافات", body, { cls: "drawer" });
  const draw = async () => {
    const all = (await chrome.management.getAll()).filter((e) => e.type === "extension" && e.id !== chrome.runtime.id).sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name));
    fill(
      body,
      h("p", { class: "muted small" }, `${all.length} إضافة — ${all.filter((e) => e.enabled).length} مفعّلة`),
      h(
        "ul",
        { class: "ext-list" },
        ...all.map((e) => {
          const ic = bestIcon(e.icons);
          return h(
            "li",
            { class: `ext-row${e.enabled ? "" : " off"}` },
            ic ? h("img", { class: "ext-icon", src: ic, alt: "" }) : h("span", { class: "ext-icon" }, icon("puzzle")),
            h("span", { class: "ext-text" }, h("strong", null, e.name), h("span", { class: "muted small" }, `${e.version}${e.description ? ` — ${e.description}` : ""}`)),
            e.optionsUrl && h("button", { type: "button", class: "round-btn small", title: "خيارات الإضافة", onclick: () => void chrome.tabs.create({ url: e.optionsUrl }) }, icon("settings")),
            e.mayDisable &&
              h(
                "button",
                {
                  type: "button",
                  class: "round-btn small",
                  title: "إزالة",
                  "aria-label": `إزالة ${e.name}`,
                  onclick: () =>
                    void chrome.management
                      .uninstall(e.id, { showConfirmDialog: true })
                      .then(draw)
                      .catch(() => undefined),
                },
                icon("x"),
              ),
            e.mayDisable &&
              h("input", {
                type: "checkbox",
                class: "switch",
                checked: e.enabled,
                "aria-label": e.enabled ? `تعطيل ${e.name}` : `تفعيل ${e.name}`,
                onchange: async (ev: Event) => {
                  await chrome.management.setEnabled(e.id, (ev.target as HTMLInputElement).checked);
                  void draw();
                },
              }),
          );
        }),
      ),
    );
  };
  void draw();
}

// ---------- apps ----------

export async function openApps(again = false) {
  // Firefox has no installed web apps (the tool is hidden there).
  if (__BROWSER__ === "firefox") return;
  if (!(await allowed("management", "#apps", again))) return;
  const body = h("div", { class: "browser-panel" });
  modal(`تطبيقات ${browserName()}`, body, { cls: "drawer" });
  const apps = (await chrome.management.getAll()).filter((e) => e.isApp && e.enabled);
  const page = isEdge() ? "edge://apps" : "chrome://apps";
  fill(
    body,
    apps.length
      ? h(
          "div",
          { class: "app-grid" },
          ...apps.map((a) =>
            h(
              "button",
              { type: "button", class: "tile tile-lg", title: a.name, onclick: () => void chrome.management.launchApp(a.id) },
              h("span", { class: "tile-face" }, bestIcon(a.icons) ? h("img", { class: "tile-icon custom", src: bestIcon(a.icons)!, alt: "" }) : icon("app-window")),
              h("span", { class: "tile-name" }, a.name),
            ),
          ),
        )
      : h("p", { class: "muted" }, "لا تطبيقات مثبّتة يمكن عرضها هنا."),
    h("button", { type: "button", class: "btn", onclick: () => void chrome.tabs.create({ url: page }) }, icon("external-link"), `صفحة التطبيقات في ${browserName()}`),
  );
}
