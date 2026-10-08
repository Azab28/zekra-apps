/**
 * The search box of the Edge and Firefox builds (scripts/build-extension.ts
 * swaps it for search.ts): an engine picker (Google, Bing, DuckDuckGo, YouTube,
 * the Quran on the site, Wikipedia), suggestions as you type when chosen
 * (Google's suggestion service, an optional host permission), arrow keys
 * through them. Never in Chrome's build: its store allows only the browser's
 * own engine on a new tab («Red Argon»).
 */
import { $, closePopover, fill, h, icon, popover } from "../lib/dom";
import { serviceIcon } from "../lib/icons";
import { ENGINES } from "../lib/settings";
export { SUGGEST_ORIGIN } from "../lib/settings";
import { S, update } from "./state";
import { openUrl } from "./ui";

let kept = "";

export function renderSearch() {
  const box = $("#search");
  box.hidden = !S.search.show;
  if (!S.search.show) return fill(box);
  box.className = `search search-${S.search.size}`;
  const engine = ENGINES.find((e) => e.id === S.search.engine) ?? ENGINES[0];
  const input = h("input", {
    class: "search-input",
    type: "search",
    name: "q",
    value: kept,
    placeholder: `ابحث في ${engine.name}`,
    autocomplete: "off",
    role: "combobox",
    "aria-autocomplete": "list",
    "aria-expanded": "false",
    "aria-controls": "search-suggest",
  });
  const list = h("ul", { class: "suggest panel", id: "search-suggest", role: "listbox", hidden: true });
  let items: string[] = [];
  let active = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let asked = 0;
  const go = (q: string) => {
    const words = q.trim();
    if (!words) return;
    kept = S.search.keep ? words : "";
    openUrl(engine.url.replace("{q}", encodeURIComponent(words)), S.dock.newTab);
    if (!S.search.keep) input.value = "";
    hide();
  };
  const hide = () => {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    active = -1;
  };
  const show = () => {
    fill(
      list,
      ...items.map((s, i) =>
        h(
          "li",
          {
            role: "option",
            id: `sg-${i}`,
            class: i === active ? "on" : "",
            "aria-selected": String(i === active),
            onmousedown: (e: MouseEvent) => {
              e.preventDefault();
              go(s);
            },
          },
          icon("search"),
          s,
        ),
      ),
    );
    list.hidden = !items.length;
    input.setAttribute("aria-expanded", String(items.length > 0));
    if (active >= 0) input.setAttribute("aria-activedescendant", `sg-${active}`);
    else input.removeAttribute("aria-activedescendant");
  };
  input.addEventListener("input", () => {
    kept = input.value;
    clearTimeout(timer);
    if (!S.search.suggest || !input.value.trim()) return ((items = []), hide());
    timer = setTimeout(async () => {
      // A slower answer to an earlier query must not replace a newer one.
      const mine = ++asked;
      const got = await suggestions(input.value.trim());
      if (mine !== asked) return;
      items = got;
      active = -1;
      show();
    }, 150);
  });
  input.addEventListener("keydown", (e) => {
    if (list.hidden || !items.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      // Past either end comes back to what was typed (-1).
      if (e.key === "ArrowDown") active = active + 1 >= items.length ? -1 : active + 1;
      else active = active <= -1 ? items.length - 1 : active - 1;
      input.value = active >= 0 ? items[active] : kept;
      show();
    } else if (e.key === "Escape") hide();
  });
  input.addEventListener("blur", () => setTimeout(hide, 100));
  const picker = h(
    "button",
    { type: "button", class: "engine-pick", title: "محرك البحث", "aria-haspopup": "listbox" },
    engineLogo(engine.id, engine.url),
    h("span", { class: "engine-name" }, engine.name),
    icon("chevron-down", "icon chevron"),
  );
  picker.addEventListener("click", () =>
    popover(
      picker,
      h(
        "div",
        { class: "menu-list", role: "listbox", "aria-label": "محرك البحث" },
        ...ENGINES.map((e) =>
          h(
            "button",
            {
              type: "button",
              role: "option",
              "aria-selected": String(e.id === engine.id),
              class: `menu-item${e.id === engine.id ? " on" : ""}`,
              onclick: () => {
                closePopover();
                void update((st) => ({ ...st, search: { ...st.search, engine: e.id } }));
              },
            },
            engineLogo(e.id, e.url),
            h("span", { class: "grow" }, e.name),
            e.id === engine.id && icon("check"),
          ),
        ),
      ),
      "engine-pop",
    ),
  );
  fill(
    box,
    h(
      "form",
      {
        class: "search-form panel",
        role: "search",
        onsubmit: (e: Event) => {
          e.preventDefault();
          go(input.value);
        },
      },
      !S.search.hideEngines && picker,
      icon("search", "icon search-icon"),
      input,
      !S.search.hideButton && h("button", { type: "submit", class: "search-go", "aria-label": "ابحث" }, icon("search")),
    ),
    list,
  );
}

/** An engine's logo (ours for the Quran search). */
function engineLogo(id: string, url: string) {
  const src = id === "quran" ? "icons/32.png" : serviceIcon(new URL(url.replace("{q}", "")).origin + "/");
  return h("img", { class: "engine-logo", src, alt: "" });
}

async function suggestions(q: string): Promise<string[]> {
  try {
    const res = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&hl=ar&q=${encodeURIComponent(q)}`);
    const data = (await res.json()) as [string, string[]];
    return data[1].slice(0, 8);
  } catch {
    return [];
  }
}
