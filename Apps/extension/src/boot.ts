// Loaded blocking in <head>: the theme and the background before the first paint
// (the settings in chrome.storage are async). newtab.ts keeps these keys up to date.
export {};

const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const root = document.documentElement;
const theme = get("theme") ?? "glass-dark";
root.dataset.theme = theme;
if (theme === "dark" || theme === "glass-dark") root.classList.add("dark");
// The photo picked for this tab by the previous one (already in the HTTP cache).
const src = get("bg.src");
const color = get("bg.color");
if (color) root.style.setProperty("--tint", color);
if (src) root.style.setProperty("--bg-image", `url("${src.replace(/"/g, "%22")}")`);
const blur = Number(get("bg.blur")) || 0;
root.style.setProperty("--bg-blur", `${blur}px`);
root.style.setProperty("--bg-blur-scale", String(blur * 0.004));
