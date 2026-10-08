/**
 * The new tab, after Quran Tab's layout: the time and dates, the tools corner
 * (weather, to-dos, notes, the browser's bookmarks/history/extensions/apps,
 * «أذكار وأدعية»), a shortcuts dock on any edge, the search box, the ayah card
 * with its recitation, the prayer card, and settings with background photos
 * under frosted glass.
 */
import { fitText, renderAyahCard, startAyah } from "./newtab/ayah";
import { initBackground } from "./newtab/background";
import { renderBottomEnd, renderBottomStart } from "./newtab/bottom";
import { renderClock } from "./newtab/clock";
import { refreshEditor, renderDock } from "./newtab/dock";
import { renderPrayers } from "./newtab/prayers";
import { renderSearch } from "./newtab/search";
import { openSettings, renderSettings } from "./newtab/settings-dialog";
import { initState, subscribe } from "./newtab/state";
import { openTodo } from "./newtab/todo";
import { openApps, openBookmarks, openExtensions, openHistory } from "./newtab/browser";
import { renderTools } from "./newtab/tools";
import { TODO_KEY } from "./lib/data";
import { $ } from "./lib/dom";
import { onRadioChange, radioState } from "./lib/radio";

async function main() {
  await initState();
  await initBackground();
  renderClock(true);
  void renderTools();
  void renderDock();
  renderSearch();
  startAyah();
  renderPrayers();
  renderBottomEnd();
  renderBottomStart(await radioState());
  onRadioChange(renderBottomStart);

  subscribe(() => {
    renderClock(true);
    void renderTools();
    void renderDock();
    refreshEditor();
    renderSearch();
    renderAyahCard();
    renderPrayers();
    renderBottomEnd();
    if ($<HTMLDialogElement>("#settings").open) renderSettings();
  });
  // The to-do count on its icon follows the lists (also when a reminder's «تم» ticks one).
  chrome.storage.onChanged.addListener((changes, area) => area === "local" && changes[TODO_KEY] && void renderTools());

  setInterval(renderClock, 1000);
  setInterval(renderPrayers, 30_000);
  $<HTMLDialogElement>("#settings").addEventListener("click", (e) => {
    // A click on the backdrop closes the window.
    if (e.target === e.currentTarget) (e.currentTarget as HTMLDialogElement).close();
  });
  let resize: ReturnType<typeof setTimeout>;
  window.addEventListener("resize", () => {
    clearTimeout(resize);
    resize = setTimeout(fitText, 100);
  });
  // A reminder's notification opens the to-dos.
  if (location.hash === "#todo") {
    history.replaceState(null, "", location.pathname);
    void openTodo();
  }
  // Reloaded after a permission was granted (browser.ts): the panel opens again.
  const panels: Record<string, (again: boolean) => Promise<void>> = { "#bookmarks": openBookmarks, "#history": openHistory, "#extensions": openExtensions, "#apps": openApps };
  const panel = panels[location.hash];
  if (panel) {
    history.replaceState(null, "", location.pathname);
    void panel(true);
  }
  // The popup's gear opens a settings page.
  if (location.hash.startsWith("#settings-")) {
    const page = location.hash.slice("#settings-".length);
    history.replaceState(null, "", location.pathname);
    openSettings(page);
  }
}

void main();
