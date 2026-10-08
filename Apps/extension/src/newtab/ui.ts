/** Small controls shared by the new tab's cards. */
import { h, icon } from "../lib/dom";

type Option = [value: string, label: string] | HTMLElement;

/** A native select dressed as a pill (keyboard and screen readers get the real control). */
export function chipSelect(opts: { icon?: string; label: string; value: string; options: Option[]; onchange: (v: string) => void; cls?: string }) {
  const select = h(
    "select",
    { "aria-label": opts.label, onchange: (e: Event) => opts.onchange((e.target as HTMLSelectElement).value) },
    ...opts.options.map((o) => (o instanceof HTMLElement ? o : h("option", { value: o[0] }, o[1]))),
  );
  select.value = opts.value;
  return h("label", { class: `chip chip-select ${opts.cls ?? ""}`, title: opts.label }, opts.icon && icon(opts.icon), select, icon("chevron-down", "icon chevron"));
}

export function chipButton(label: string | Node, onclick: (e: MouseEvent) => void, ic?: string, title?: string) {
  return h("button", { class: "chip", type: "button", onclick, title: title ?? (typeof label === "string" ? label : undefined) }, ic && icon(ic), label);
}

export function iconButton(ic: string, label: string, onclick: (e: MouseEvent) => void, cls = "") {
  return h("button", { class: `round-btn ${cls}`, type: "button", title: label, "aria-label": label, onclick }, icon(ic));
}

export function toggleRow(label: string, checked: boolean, onchange: (v: boolean) => void, hint?: string) {
  return h(
    "label",
    { class: "set-row" },
    h("span", null, label, hint && h("small", null, hint)),
    h("input", { type: "checkbox", class: "switch", checked, onchange: (e: Event) => onchange((e.target as HTMLInputElement).checked) }),
  );
}

export function selectRow(label: string, value: string, options: Option[], onchange: (v: string) => void) {
  const el = h(
    "select",
    { class: "field", onchange: (e: Event) => onchange((e.target as HTMLSelectElement).value) },
    ...options.map((o) => (o instanceof HTMLElement ? o : h("option", { value: o[0] }, o[1]))),
  );
  el.value = value;
  return h("label", { class: "set-row" }, h("span", null, label), el);
}

/** Opens a link from the new tab: here, or in a new tab when asked. */
export function openUrl(url: string, newTab = false) {
  if (newTab) void chrome.tabs.create({ url });
  else location.href = url;
}
