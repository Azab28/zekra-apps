/** Which photo this tab shows, the next tab's (changing each tab when automatic), and switching by hand. */
import { bgById, customBackground, paint, pool, prepareNext, preparedId, randomFrom, type Shown } from "../lib/backgrounds";
import type { ExtBackground } from "../lib/types";
import { S, update } from "./state";

let shown: Shown | null = null;
export const shownBackground = () => shown;

const asShown = (bg: ExtBackground): Shown => ({ src: bg.url, color: bg.color, bg });

export async function initBackground() {
  if (S.background.category === "custom") {
    const c = await customBackground();
    if (c) {
      show({ ...c, bg: null });
      prepareNext({ ...c, id: null });
      return;
    }
  }
  const list = pool(S);
  const prepared = bgById(preparedId());
  const current = S.background.auto
    ? prepared && list.includes(prepared)
      ? prepared
      : randomFrom(list)
    : (bgById(S.background.id) ?? prepared ?? randomFrom(list));
  show(asShown(current));
  const next = S.background.auto ? randomFrom(list, current.id) : current;
  prepareNext({ src: next.url, color: next.color, id: next.id });
}

function show(s: Shown) {
  shown = s;
  paint(s, S.background.blur);
}

/** A photo picked in the settings: shown now and kept (automatic change stays as set). */
export async function chooseBackground(bg: ExtBackground) {
  show(asShown(bg));
  prepareNext({ src: bg.url, color: bg.color, id: bg.id });
  const category = S.background.category === "favorites" || S.background.category === bg.category ? S.background.category : bg.category;
  await update((s) => ({ ...s, background: { ...s.background, id: bg.id, category } }));
}

/** The shuffle button: another photo from the same set. */
export async function shuffleBackground() {
  const list = pool(S);
  const bg = randomFrom(list, shown?.bg?.id);
  await chooseBackground(bg);
}

export async function showCustom() {
  const c = await customBackground();
  if (!c) return;
  show({ ...c, bg: null });
  prepareNext({ ...c, id: null });
}

/** Re-applies the blur. */
export const refreshBackground = () => shown && paint(shown, S.background.blur);
