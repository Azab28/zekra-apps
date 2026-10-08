/**
 * «المهام»: to-do lists in a side panel. Several lists (the main one can't be
 * deleted), tasks with a star, a due time with a reminder (the service worker
 * notifies; «تم» from the notification ticks it), a note, quick due times, and
 * the finished ones folded away.
 */
import { confirmDialog, fill, h, icon, modal, promptDialog, toast } from "../lib/dom";
import { loadLists, newTodo, saveLists, TODO_KEY, type Todo, type TodoList } from "../lib/data";
import { newId } from "../lib/settings";
import { n } from "../lib/times";

let lists: TodoList[] = [];
let current = "main";
let showDone = false;
let editing: string | null = null;

const listOf = () => lists.find((l) => l.id === current) ?? lists[0];
const save = () => saveLists(lists);

export async function openTodo() {
  lists = await loadLists();
  if (!lists.some((l) => l.id === current)) current = lists[0].id;
  const body = h("div", { class: "todo" });
  const draw = () => drawTodo(body);
  const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    // A task ticked from a notification while the panel is open.
    if (area === "local" && changes[TODO_KEY] && document.contains(body)) void loadLists().then((l) => ((lists = l), draw()));
  };
  chrome.storage.onChanged.addListener(onChange);
  modal("المهام", body, { cls: "drawer", onClose: () => chrome.storage.onChanged.removeListener(onChange) });
  draw();
}

/** Open tasks across every list (the dot on the toolbar icon). */
export async function openCount() {
  return (await loadLists()).reduce((s, l) => s + l.todos.filter((t) => !t.done).length, 0);
}

const sorted = (todos: Todo[]) =>
  [...todos].sort((a, b) => Number(b.important) - Number(a.important) || (a.due ?? Infinity) - (b.due ?? Infinity) || a.created - b.created);

function dueLabel(t: Todo) {
  if (!t.due) return null;
  const d = new Date(t.due);
  const now = new Date();
  const sameDay = (x: Date, y: Date) => x.toDateString() === y.toDateString();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const time = new Intl.DateTimeFormat("ar-EG", { hour: "numeric", minute: "2-digit" }).format(d);
  const day = sameDay(d, now) ? "اليوم" : sameDay(d, tomorrow) ? "غدًا" : new Intl.DateTimeFormat("ar-EG", { weekday: "short", day: "numeric", month: "short" }).format(d);
  const late = !t.done && t.due < Date.now();
  return h("span", { class: `due${late ? " late" : ""}` }, icon(t.remind ? "bell" : "calendar-days"), `${day} ${time}`);
}

function drawTodo(body: HTMLElement) {
  const list = listOf();
  const open = sorted(list.todos.filter((t) => !t.done));
  const done = list.todos.filter((t) => t.done);
  const input = h("input", { class: "field", placeholder: "أضف مهمة واضغط Enter", maxlength: "300", "aria-label": "مهمة جديدة" });
  const redraw = () => drawTodo(body);
  fill(
    body,
    h(
      "div",
      { class: "list-tabs", role: "tablist" },
      ...lists.map((l) =>
        h(
          "button",
          { type: "button", role: "tab", class: `tab${l.id === current ? " on" : ""}`, "aria-selected": String(l.id === current), onclick: () => ((current = l.id), (editing = null), redraw()) },
          l.title,
          h("span", { class: "count" }, n(l.todos.filter((t) => !t.done).length)),
        ),
      ),
      h(
        "button",
        {
          type: "button",
          class: "tab",
          title: "قائمة جديدة",
          onclick: async () => {
            const title = await promptDialog("قائمة جديدة", { placeholder: "اسم القائمة", ok: "إضافة", max: 40 });
            if (!title) return;
            const l: TodoList = { id: newId(), title: title.slice(0, 40), todos: [] };
            lists.push(l);
            current = l.id;
            await save();
            redraw();
          },
        },
        icon("plus"),
      ),
    ),
    h(
      "form",
      {
        class: "row add-todo",
        onsubmit: async (e: Event) => {
          e.preventDefault();
          if (!input.value.trim()) return;
          list.todos.push(newTodo(input.value));
          await save();
          redraw();
          body.querySelector<HTMLInputElement>(".add-todo input")?.focus();
        },
      },
      input,
      h("button", { type: "submit", class: "btn primary icon-btn", "aria-label": "إضافة" }, icon("plus")),
    ),
    open.length ? h("ul", { class: "todo-list" }, ...open.map((t) => row(t, list, redraw))) : h("p", { class: "muted empty" }, "لا مهام هنا. أضف أول مهمة."),
    done.length > 0 &&
      h(
        "div",
        { class: "done-head" },
        h("button", { type: "button", class: "btn ghost", "aria-expanded": String(showDone), onclick: () => ((showDone = !showDone), redraw()) }, icon(showDone ? "chevron-down" : "chevron-left"), `المكتملة (${n(done.length)})`),
        h(
          "button",
          {
            type: "button",
            class: "btn ghost",
            onclick: async () => {
              list.todos = list.todos.filter((t) => !t.done);
              await save();
              redraw();
            },
          },
          "مسح المكتملة",
        ),
      ),
    showDone && done.length > 0 && h("ul", { class: "todo-list done" }, ...done.map((t) => row(t, list, redraw))),
    list.id !== "main" &&
      h(
        "div",
        { class: "row end list-actions" },
        h(
          "button",
          {
            type: "button",
            class: "btn ghost",
            onclick: async () => {
              const title = await promptDialog("اسم القائمة", { value: list.title, max: 40 });
              if (!title) return;
              list.title = title.slice(0, 40);
              await save();
              redraw();
            },
          },
          icon("pencil"),
          "إعادة التسمية",
        ),
        h(
          "button",
          {
            type: "button",
            class: "btn ghost danger",
            onclick: async () => {
              if (!(await confirmDialog(`حذف قائمة «${list.title}» بكل مهامها؟`, { ok: "حذف", danger: true }))) return;
              lists = lists.filter((l) => l.id !== list.id);
              current = lists[0].id;
              await save();
              redraw();
            },
          },
          icon("x"),
          "حذف القائمة",
        ),
      ),
  );
  if (!editing) input.focus();
}

function row(t: Todo, list: TodoList, redraw: () => void) {
  const set = async (patch: Partial<Todo>) => {
    Object.assign(t, patch);
    await save();
    redraw();
  };
  return h(
    "li",
    { class: `todo-item${t.done ? " is-done" : ""}` },
    h(
      "div",
      { class: "todo-main" },
      h("input", { type: "checkbox", class: "check", checked: t.done, "aria-label": "تمت", onchange: () => void set({ done: !t.done }) }),
      h(
        "button",
        { type: "button", class: "todo-text", onclick: () => ((editing = editing === t.id ? null : t.id), redraw()) },
        h("span", null, t.text),
        (t.due || t.note) && h("span", { class: "todo-meta" }, dueLabel(t), t.note && h("span", { class: "muted" }, icon("pencil"), "ملاحظة")),
      ),
      h("button", { type: "button", class: `round-btn small star${t.important ? " on" : ""}`, title: "مهمة", "aria-pressed": String(t.important), onclick: () => void set({ important: !t.important }) }, icon("star")),
    ),
    editing === t.id && details(t, list, set, redraw),
  );
}

/** A task opened: its words, note, due time and reminder, and delete. */
function details(t: Todo, list: TodoList, set: (p: Partial<Todo>) => Promise<void>, redraw: () => void) {
  const local = (ms: number) => {
    const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000);
    return d.toISOString().slice(0, 16);
  };
  const text = h("input", { class: "field", value: t.text, maxlength: "300", "aria-label": "المهمة" });
  const note = h("textarea", { class: "field", rows: "2", placeholder: "ملاحظة", maxlength: "1000" }, t.note ?? "");
  const due = h("input", { class: "field", type: "datetime-local", value: t.due ? local(t.due) : "", "aria-label": "الموعد" });
  const remind = h("input", { type: "checkbox", class: "switch", checked: t.remind !== false && !!t.due });
  const at = (days: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    due.value = local(d.getTime());
    remind.checked = true;
  };
  return h(
    "form",
    {
      class: "todo-details",
      onsubmit: async (e: Event) => {
        e.preventDefault();
        const ms = due.value ? new Date(due.value).getTime() : undefined;
        if (ms && remind.checked && ms <= Date.now()) return toast("اختر موعدًا قادمًا للتذكير");
        editing = null;
        await set({ text: text.value.trim() || t.text, note: note.value.trim() || undefined, due: ms, remind: !!ms && remind.checked });
      },
    },
    text,
    note,
    h(
      "div",
      { class: "quick-due" },
      h("span", { class: "muted" }, "موعد سريع:"),
      h("button", { type: "button", class: "chip", onclick: () => at(0, 20) }, "اليوم ٨ م"),
      h("button", { type: "button", class: "chip", onclick: () => at(1, 9) }, "غدًا ٩ ص"),
      h("button", { type: "button", class: "chip", onclick: () => at(7, 9) }, "بعد أسبوع"),
    ),
    h("div", { class: "row" }, due, h("label", { class: "row" }, remind, "تذكير")),
    h(
      "div",
      { class: "row end" },
      h(
        "button",
        {
          type: "button",
          class: "btn ghost danger",
          onclick: async () => {
            list.todos = list.todos.filter((x) => x.id !== t.id);
            editing = null;
            await save();
            redraw();
          },
        },
        icon("x"),
        "حذف",
      ),
      h("button", { type: "submit", class: "btn primary" }, icon("check"), "حفظ"),
    ),
  );
}
