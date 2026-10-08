/**
 * «الملاحظات»: notes in a side panel — search, pinned first then the latest,
 * a colour each, saved as you type; copy and delete.
 */
import { confirmDialog, fill, h, icon, modal, toast } from "../lib/dom";
import { loadNotes, newNote, saveNotes, type Note, type NoteColor } from "../lib/data";

const COLORS: [NoteColor, string][] = [
  ["plain", "بدون"],
  ["green", "أخضر"],
  ["gold", "ذهبي"],
  ["blue", "أزرق"],
  ["rose", "وردي"],
];

let notes: Note[] = [];
let open: string | null = null;
let query = "";

export async function openNotes() {
  notes = await loadNotes();
  open = null;
  query = "";
  const body = h("div", { class: "notes" });
  modal("الملاحظات", body, { cls: "drawer" });
  draw(body);
}

const save = () => saveNotes(notes);
const when = (ms: number) => new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(ms);

function draw(body: HTMLElement) {
  const note = notes.find((x) => x.id === open);
  if (note) return editor(body, note);
  const q = query.trim().toLowerCase();
  const list = notes
    .filter((x) => !q || `${x.title}\n${x.body}`.toLowerCase().includes(q))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated - a.updated);
  const search = h("input", {
    class: "field",
    type: "search",
    placeholder: "ابحث في الملاحظات",
    value: query,
    oninput: (e: Event) => {
      query = (e.target as HTMLInputElement).value;
      draw(body);
      body.querySelector<HTMLInputElement>("input[type=search]")?.focus();
    },
  });
  fill(
    body,
    h(
      "div",
      { class: "row" },
      search,
      h(
        "button",
        {
          type: "button",
          class: "btn primary",
          onclick: async () => {
            const x = newNote();
            notes.unshift(x);
            open = x.id;
            await save();
            draw(body);
          },
        },
        icon("plus"),
        "ملاحظة",
      ),
    ),
    list.length
      ? h(
          "div",
          { class: "note-grid" },
          ...list.map((x) =>
            h(
              "button",
              { type: "button", class: `note-card c-${x.color}`, onclick: () => ((open = x.id), draw(body)) },
              x.pinned && icon("pin", "icon pin"),
              h("strong", null, x.title || firstLine(x.body) || "بدون عنوان"),
              h("span", { class: "note-body" }, x.title ? x.body : x.body.split("\n").slice(1).join("\n")),
              h("span", { class: "muted small" }, when(x.updated)),
            ),
          ),
        )
      : h("p", { class: "muted empty" }, q ? "لا نتائج." : "لا ملاحظات بعد."),
  );
}

const firstLine = (s: string) => s.split("\n")[0].slice(0, 60);

function editor(body: HTMLElement, x: Note) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stamp = h("span", { class: "muted small" }, `آخر تعديل ${when(x.updated)}`);
  const changed = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      x.title = title.value.slice(0, 120);
      x.body = text.value.slice(0, 20_000);
      x.updated = Date.now();
      await save();
      stamp.textContent = `حُفظت ${when(x.updated)}`;
    }, 400);
  };
  const title = h("input", { class: "field note-title", placeholder: "العنوان", value: x.title, maxlength: "120", oninput: changed });
  const text = h("textarea", { class: "field note-text", placeholder: "اكتب ملاحظتك…", oninput: changed }, x.body);
  /** What is typed but not saved yet (the panel is about to be redrawn). */
  const flush = () => {
    clearTimeout(timer);
    x.title = title.value.slice(0, 120);
    x.body = text.value.slice(0, 20_000);
  };
  const back = async () => {
    flush();
    // An empty new note isn't kept.
    if (!x.title.trim() && !x.body.trim()) notes = notes.filter((y) => y.id !== x.id);
    await save();
    open = null;
    draw(body);
  };
  fill(
    body,
    h(
      "div",
      { class: "row note-bar" },
      h("button", { type: "button", class: "btn ghost", onclick: back }, icon("chevron-right"), "كل الملاحظات"),
      h("span", { class: "grow" }),
      h(
        "button",
        {
          type: "button",
          class: `round-btn small${x.pinned ? " on" : ""}`,
          title: x.pinned ? "إلغاء التثبيت" : "تثبيت في الأعلى",
          "aria-pressed": String(x.pinned),
          onclick: async () => {
            flush();
            x.pinned = !x.pinned;
            await save();
            editor(body, x);
          },
        },
        icon("pin"),
      ),
      h(
        "button",
        {
          type: "button",
          class: "round-btn small",
          title: "نسخ",
          onclick: async () => {
            await navigator.clipboard.writeText([title.value, text.value].filter(Boolean).join("\n\n"));
            toast("نُسخت الملاحظة");
          },
        },
        icon("copy"),
      ),
      h(
        "button",
        {
          type: "button",
          class: "round-btn small",
          title: "حذف",
          onclick: async () => {
            if ((x.title || x.body) && !(await confirmDialog("حذف هذه الملاحظة؟", { ok: "حذف", danger: true }))) return;
            notes = notes.filter((y) => y.id !== x.id);
            await save();
            open = null;
            draw(body);
          },
        },
        icon("x"),
      ),
    ),
    h(
      "div",
      { class: "note-colors", role: "radiogroup", "aria-label": "اللون" },
      ...COLORS.map(([c, label]) =>
        h("button", {
          type: "button",
          class: `swatch c-${c}${x.color === c ? " on" : ""}`,
          title: label,
          "aria-label": label,
          "aria-checked": String(x.color === c),
          role: "radio",
          onclick: async () => {
            flush();
            x.color = c;
            await save();
            editor(body, x);
          },
        }),
      ),
    ),
    title,
    text,
    stamp,
  );
  if (!x.title && !x.body) title.focus();
}
