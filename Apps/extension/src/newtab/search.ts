/**
 * The search box: a web search with the search engine the user chose in the
 * browser (chrome.search), never an engine of ours — the Chrome Web Store's
 * rule for a new tab page with a search box.
 */
import { $, fill, h, icon } from "../lib/dom";
import { S } from "./state";

let kept = "";

export function renderSearch() {
  const box = $("#search");
  box.hidden = !S.search.show;
  if (!S.search.show) return fill(box);
  box.className = `search search-${S.search.size}`;
  const input = h("input", { class: "search-input", type: "search", name: "q", value: kept, placeholder: "ابحث في الويب", autocomplete: "off", "aria-label": "ابحث في الويب" });
  input.addEventListener("input", () => (kept = input.value));
  fill(
    box,
    h(
      "form",
      {
        class: "search-form panel",
        role: "search",
        onsubmit: (e: Event) => {
          e.preventDefault();
          const text = input.value.trim();
          if (!text) return;
          kept = S.search.keep ? text : "";
          if (!S.search.keep) input.value = "";
          void chrome.search.query({ text, disposition: S.dock.newTab ? "NEW_TAB" : "CURRENT_TAB" });
        },
      },
      icon("search", "icon search-icon"),
      input,
      !S.search.hideButton && h("button", { type: "submit", class: "search-go", "aria-label": "ابحث" }, icon("search")),
    ),
  );
}
