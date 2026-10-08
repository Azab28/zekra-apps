/** The top corner: weather, to-dos, notes, bookmarks, history, extensions, apps and «أذكار وأدعية» (each can be hidden). */
import { $, fill, h, icon } from "../lib/dom";
import { n } from "../lib/times";
import { azkarButton } from "./azkar";
import { BROWSER_TOOLS, browserName, openApps, openBookmarks, openExtensions, openHistory } from "./browser";
import { openNotes } from "./notes";
import { S } from "./state";
import { openCount, openTodo } from "./todo";
import { weatherChip } from "./weather";

const tool = (ic: string, label: string, onclick: () => void, badge?: number) =>
  h(
    "button",
    { type: "button", class: "round-btn tool", title: label, "aria-label": badge ? `${label} (${badge})` : label, onclick },
    icon(ic),
    badge ? h("span", { class: "badge" }, n(Math.min(badge, 99))) : null,
  );

export async function renderTools() {
  const t = S.tools;
  const [weather, todos] = await Promise.all([t.weather ? weatherChip() : null, t.todo ? openCount() : 0]);
  fill(
    $("#tools"),
    weather,
    h(
      "div",
      { class: "tool-group panel" },
      t.todo && tool("list-todo", "المهام", () => void openTodo(), todos),
      t.notes && tool("notebook-pen", "الملاحظات", () => void openNotes()),
      t.bookmarks && tool("bookmark", "الإشارات المرجعية", () => void openBookmarks()),
      t.history && tool("history", "السجل", () => void openHistory()),
      t.extensions && BROWSER_TOOLS("extensions") && tool("puzzle", "إدارة الإضافات", () => void openExtensions()),
      t.apps && BROWSER_TOOLS("apps") && tool("layout-grid", `تطبيقات ${browserName()}`, () => void openApps()),
    ),
    t.azkar && azkarButton(),
  );
  const group = document.querySelector<HTMLElement>("#tools .tool-group");
  if (group && !group.children.length) group.remove();
}
