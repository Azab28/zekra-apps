/** The new tab's settings in one place: every part re-renders when they change (here or in another tab). */
import { applyTheme } from "../lib/dom";
import { loadSettings, onSettingsChange, saveSettings, type Settings } from "../lib/settings";

export let S: Settings;
const listeners = new Set<() => void>();

export const subscribe = (fn: () => void) => void listeners.add(fn);

function emit() {
  applyTheme(S.theme);
  for (const fn of listeners) fn();
}

export async function initState() {
  S = await loadSettings();
  applyTheme(S.theme);
  onSettingsChange((next) => {
    if (JSON.stringify(next) === JSON.stringify(S)) return;
    S = next;
    emit();
  });
}

export async function update(change: Partial<Settings> | ((s: Settings) => Settings)) {
  S = typeof change === "function" ? change(S) : { ...S, ...change };
  emit();
  await saveSettings(S);
}

export const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
export const zone = () => S.place?.timezone ?? deviceZone;
