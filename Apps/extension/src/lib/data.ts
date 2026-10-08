/** To-do lists and notes, kept in chrome.storage.local (copied to the Chrome account by sync.ts when chosen). */
import { newId } from "./settings";

export type Todo = {
  id: string;
  text: string;
  done: boolean;
  /** Starred: listed first. */
  important: boolean;
  /** When it is due (ms); with `remind`, a notification then. */
  due?: number;
  remind?: boolean;
  note?: string;
  created: number;
};
export type TodoList = { id: string; title: string; todos: Todo[] };

export type NoteColor = "plain" | "green" | "gold" | "blue" | "rose";
export type Note = { id: string; title: string; body: string; color: NoteColor; pinned: boolean; updated: number };

export const TODO_KEY = "todo.lists";
export const NOTES_KEY = "notes";

const defaultLists = (): TodoList[] => [{ id: "main", title: "المهام", todos: [] }];

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => !!v && typeof v === "object";
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const NOTE_COLORS: NoteColor[] = ["plain", "green", "gold", "blue", "rose"];

function cleanTodo(t: unknown): Todo | null {
  if (!isObj(t) || typeof t.id !== "string" || typeof t.text !== "string") return null;
  return {
    id: t.id.slice(0, 40),
    text: t.text.slice(0, 300),
    done: t.done === true,
    important: t.important === true,
    due: num(t.due),
    remind: t.remind === true,
    note: typeof t.note === "string" ? t.note.slice(0, 1000) : undefined,
    created: num(t.created) ?? 0,
  };
}

/** Stored or imported lists, malformed entries dropped (a backup file or another computer's copy can be anything). */
export function cleanLists(v: unknown): TodoList[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((l): l is Raw => isObj(l) && typeof l.id === "string" && Array.isArray(l.todos))
    .slice(0, 50)
    .map((l) => ({
      id: String(l.id).slice(0, 40),
      title: typeof l.title === "string" && l.title.trim() ? l.title.slice(0, 40) : "المهام",
      todos: (l.todos as unknown[]).map(cleanTodo).filter((t): t is Todo => !!t).slice(0, 2000),
    }));
}

export function cleanNotes(v: unknown): Note[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((n): n is Raw => isObj(n) && typeof n.id === "string")
    .slice(0, 2000)
    .map((n) => ({
      id: String(n.id).slice(0, 40),
      title: typeof n.title === "string" ? n.title.slice(0, 200) : "",
      body: typeof n.body === "string" ? n.body.slice(0, 20_000) : "",
      color: NOTE_COLORS.includes(n.color as NoteColor) ? (n.color as NoteColor) : "plain",
      pinned: n.pinned === true,
      updated: num(n.updated) ?? 0,
    }));
}

export async function loadLists(): Promise<TodoList[]> {
  const v = cleanLists((await chrome.storage.local.get(TODO_KEY))[TODO_KEY]);
  return v.length ? v : defaultLists();
}
export const saveLists = (lists: TodoList[]) => chrome.storage.local.set({ [TODO_KEY]: lists });

export async function loadNotes(): Promise<Note[]> {
  return cleanNotes((await chrome.storage.local.get(NOTES_KEY))[NOTES_KEY]);
}
export const saveNotes = (notes: Note[]) => chrome.storage.local.set({ [NOTES_KEY]: notes });

export const newTodo = (text: string): Todo => ({ id: newId(), text: text.trim().slice(0, 300), done: false, important: false, created: Date.now() });
export const newNote = (): Note => ({ id: newId(), title: "", body: "", color: "plain", pinned: false, updated: Date.now() });

/** Reminders that are still ahead: what the service worker sets alarms for. */
export function dueReminders(lists: TodoList[], now = Date.now()) {
  return lists.flatMap((l) => l.todos.filter((t) => t.remind && t.due && t.due > now && !t.done).map((t) => ({ list: l.id, todo: t })));
}
