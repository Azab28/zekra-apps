/** «أذكار وأدعية»: one button; its panel shows a zikr from Hisn al-Muslim and opens the reader's chapters. */
import { fill, h, icon, popover, siteUrl } from "../lib/dom";
import type { ExtZikr } from "../lib/types";
import { iconButton, openUrl } from "./ui";
import { S } from "./state";

const AZKAR: ExtZikr[] = __AZKAR__;
const CHAPTERS: [string, string, string][] = [
  ["/r/morning", "أذكار الصباح", "sun"],
  ["/r/evening", "أذكار المساء", "moon"],
  ["/r/sleep", "أذكار النوم", "moon-star"],
  ["/r", "حصن المسلم", "sparkles"],
  ["/tasbeeh", "السبحة", "circle-dot"],
  ["/asma", "أسماء الله الحسنى", "hand-heart"],
];

let index = Math.floor(Math.random() * AZKAR.length);

function panel() {
  const body = h("div", { class: "azkar-panel" });
  const draw = () =>
    fill(
      body,
      h("p", { class: "zikr-text" }, AZKAR[index].text),
      h(
        "div",
        { class: "zikr-foot" },
        h("span", { class: "muted" }, AZKAR[index].chapter),
        iconButton("refresh-cw", "ذكر آخر", () => {
          index = (index + 1 + Math.floor(Math.random() * (AZKAR.length - 1))) % AZKAR.length;
          draw();
        }),
      ),
      h(
        "div",
        { class: "azkar-links" },
        ...CHAPTERS.map(([href, label, ic]) =>
          h(
            "a",
            {
              class: "azkar-link",
              href: siteUrl(href),
              onclick: (e: MouseEvent) => {
                e.preventDefault();
                openUrl(siteUrl(href), S.dock.newTab);
              },
            },
            icon(ic),
            label,
          ),
        ),
      ),
    );
  draw();
  return body;
}

export function azkarButton() {
  const btn = h("button", { class: "chip chip-strong", type: "button", "aria-haspopup": "dialog" }, icon("sparkles"), "أذكار وأدعية");
  btn.addEventListener("click", () => popover(btn, panel(), "azkar-pop"));
  return btn;
}
