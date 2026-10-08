import { isDarkTheme, type Theme } from "./settings";

/** A tiny element builder for the extension's pages (no framework: the new tab must open instantly). */

type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> | null;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = String(v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k in el && typeof v !== "string") (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  append(el, children);
  return el;
}

export function append(el: Element, children: Child[]) {
  for (const c of children) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
}

/** Replaces an element's children. */
export function fill(el: Element, ...children: Child[]) {
  el.replaceChildren();
  append(el, children);
}

/** A lucide icon (embedded at build time). */
const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_ATTRS = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" };

/** A lucide icon, built as elements from the bundled table. */
export function icon(name: string, cls = "icon"): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  for (const [k, v] of Object.entries({ ...SVG_ATTRS, class: cls })) svg.setAttribute(k, v);
  for (const [tag, attrs] of __ICONS__[name] ?? []) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  }
  return svg;
}

export const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

/** Applies the theme: the dark class for the colours, data-theme for glass or plain. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", isDarkTheme(theme));
  root.dataset.theme = theme;
}

/** A short message at the bottom of the page. */
export function toast(text: string) {
  const el = h("div", { class: "toast", role: "status" }, text);
  document.body.append(el);
  setTimeout(() => el.classList.add("out"), 1800);
  setTimeout(() => el.remove(), 2200);
}

export const siteUrl = (p = "/") => `${__SITE__}${p}`;

let openPop: { el: HTMLElement; anchor: HTMLElement; close: () => void } | null = null;

/** Closes the open popover, if any. */
export const closePopover = () => openPop?.close();

/**
 * A floating panel next to an anchor (below it, or above when there's no room),
 * closed by an outside click, Escape, or opening another. A second click on the
 * same anchor closes it.
 */
export function popover(anchor: HTMLElement, content: Node, cls = ""): HTMLElement | null {
  if (openPop?.anchor === anchor) {
    openPop.close();
    return null;
  }
  openPop?.close();
  const el = h("div", { class: `popover panel ${cls}`, role: "dialog" }, content);
  document.body.append(el);
  // The anchor may be redrawn while the popover is open (a setting changed): keep its last place.
  let rect = anchor.getBoundingClientRect();
  const place = () => {
    if (anchor.isConnected) rect = anchor.getBoundingClientRect();
    const a = rect;
    const w = el.offsetWidth;
    const hgt = el.offsetHeight;
    const gap = 8;
    let top = a.bottom + gap;
    if (top + hgt > innerHeight - 8 && a.top - gap - hgt > 8) top = a.top - gap - hgt;
    // A side dock: open beside it.
    if (a.height > a.width * 2) {
      top = Math.min(Math.max(8, a.top), innerHeight - hgt - 8);
      const left = a.left > innerWidth / 2 ? a.left - gap - w : a.right + gap;
      el.style.left = `${left}px`;
    } else {
      const left = Math.min(Math.max(8, a.left + a.width / 2 - w / 2), innerWidth - w - 8);
      el.style.left = `${left}px`;
    }
    el.style.top = `${Math.max(8, top)}px`;
  };
  place();
  const onDown = (e: Event) => {
    if (!el.contains(e.target as Node) && !anchor.contains(e.target as Node)) close();
  };
  const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
  const close = () => {
    el.remove();
    document.removeEventListener("pointerdown", onDown, true);
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", place);
    anchor.setAttribute("aria-expanded", "false");
    if (openPop?.el === el) openPop = null;
  };
  document.addEventListener("pointerdown", onDown, true);
  document.addEventListener("keydown", onKey);
  window.addEventListener("resize", place);
  anchor.setAttribute("aria-expanded", "true");
  openPop = { el, anchor, close };
  return el;
}

/** Re-positions the open popover after its content changed size. */
export const refreshPopover = () => window.dispatchEvent(new Event("resize"));

/**
 * A window over the page with a title and a close button; closed by Escape, a
 * click outside or the button, then removed. `footer` holds the actions.
 */
export function modal(title: string, body: Node, opts: { footer?: Node; cls?: string; onClose?: () => void } = {}) {
  const dlg = h("dialog", { class: `modal panel ${opts.cls ?? ""}` });
  // Cleaned up right away (Chrome may hold the «close» event of a page in the background), once.
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    dlg.remove();
    opts.onClose?.();
  };
  const close = () => {
    if (dlg.open) dlg.close();
    finish();
  };
  fill(
    dlg,
    h("div", { class: "modal-head" }, h("h2", null, title), h("button", { class: "round-btn", type: "button", "aria-label": "إغلاق", onclick: close }, icon("x"))),
    h("div", { class: "modal-body" }, body),
    opts.footer && h("div", { class: "modal-foot" }, opts.footer),
  );
  dlg.addEventListener("click", (e) => e.target === dlg && close());
  // Escape closes it without our button.
  dlg.addEventListener("close", finish);
  document.body.append(dlg);
  dlg.showModal();
  return { el: dlg, close };
}

/** Our own «are you sure?» window (never the browser's confirm()). */
export function confirmDialog(message: string, opts: { title?: string; ok?: string; cancel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    let answer = false;
    const ok = h("button", { type: "button", class: `btn primary${opts.danger ? " danger-fill" : ""}`, onclick: () => ((answer = true), m.close()) }, opts.ok ?? "تأكيد");
    const m = modal(opts.title ?? "تأكيد", h("p", { class: "dialog-text" }, message), {
      cls: "dialog",
      footer: h("div", { class: "row end" }, h("button", { type: "button", class: "btn ghost", onclick: () => m.close() }, opts.cancel ?? "إلغاء"), ok),
      onClose: () => resolve(answer),
    });
    ok.focus();
  });
}

/** Our own text question (never the browser's prompt()); null when cancelled. */
export function promptDialog(title: string, opts: { value?: string; placeholder?: string; ok?: string; max?: number } = {}): Promise<string | null> {
  return new Promise((resolve) => {
    let answer: string | null = null;
    const input = h("input", { class: "field", value: opts.value ?? "", placeholder: opts.placeholder ?? "", maxlength: String(opts.max ?? 60) });
    const form = h(
      "form",
      {
        onsubmit: (e: Event) => {
          e.preventDefault();
          const v = input.value.trim();
          if (!v) return input.focus();
          answer = v;
          m.close();
        },
      },
      input,
    );
    const m = modal(title, form, {
      cls: "dialog",
      footer: h(
        "div",
        { class: "row end" },
        h("button", { type: "button", class: "btn ghost", onclick: () => m.close() }, "إلغاء"),
        h("button", { type: "button", class: "btn primary", onclick: () => form.requestSubmit() }, opts.ok ?? "حفظ"),
      ),
      onClose: () => resolve(answer),
    });
    input.focus();
    input.select();
  });
}

/** Our own window with a few choices; null when closed without one. */
export function choiceDialog<T extends string>(title: string, message: string, choices: [T, string, boolean?][]): Promise<T | null> {
  return new Promise((resolve) => {
    let answer: T | null = null;
    const m = modal(title, h("p", { class: "dialog-text" }, message), {
      cls: "dialog",
      footer: h(
        "div",
        { class: "row end" },
        h("button", { type: "button", class: "btn ghost", onclick: () => m.close() }, "إلغاء"),
        ...choices.map(([v, label, primary]) => h("button", { type: "button", class: `btn${primary ? " primary" : ""}`, onclick: () => ((answer = v), m.close()) }, label)),
      ),
      onClose: () => resolve(answer),
    });
  });
}
