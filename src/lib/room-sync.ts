/**
 * The page's side of a shared khatma (/k/<slug>, /ali): which of the views the
 * server sends back to keep, and a memorial's counter taps, sent in batches.
 * Client-safe (no database); tested in tests/khatma-room.test.ts.
 *
 * What it shows is the server's counts plus this page's taps the server
 * doesn't have yet, so a number never goes back because a reply came late, a
 * request failed or the server was busy (429): a view read before another is
 * never kept after it (`rev`), a batch is kept and sent again until the server
 * has it (once, by its id), and while one is on its way the counts of other
 * replies aren't taken (they may or may not include it).
 */
import type { Counter } from "./group-khatma";
import type { RoomView } from "./khatma-room";

export type Counts = RoomView["counters"];
export const COUNTER_KEYS = ["tasbeeh", "istighfar", "salawat", "surahs"] as const satisfies readonly Counter[];
const NO_COUNTS: Counts = { tasbeeh: 0, istighfar: 0, salawat: 0, surahs: 0 };
/** The server adds at most this much to a counter per request (MAX_COUNTER_ADD). */
const MAX_ADD = 100;

export type CountBody = { action: "count"; slug: string; adds: Partial<Counts>; batch: string };
export type SyncReply = { ok: boolean; view?: RoomView; error?: string } | null;

type Batch = { adds: Partial<Counts>; sending: boolean };

const newBatchId = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36);

export class RoomSync {
  view: RoomView;
  private rev: { parts: number; counters: number };
  /** Taps not sent yet. */
  private pending: Counts = { ...NO_COUNTS };
  /** Batches sent (or waiting to be sent again) that the server hasn't confirmed. */
  private batches = new Map<string, Batch>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private failures = 0;
  private closed = false;
  private readonly flushMs: number;
  private readonly retryMs: number;

  constructor(
    initial: RoomView,
    private readonly io: {
      send: (body: CountBody, keepalive: boolean) => Promise<SyncReply>;
      /** Called whenever what the page shows changed. */
      changed: () => void;
      flushMs?: number;
      /** The first wait before sending a batch again (doubles each time, up to a minute). */
      retryMs?: number;
    },
  ) {
    this.view = initial;
    this.rev = { parts: initial.rev ?? 0, counters: initial.rev ?? 0 };
    this.flushMs = io.flushMs ?? 1500;
    this.retryMs = io.retryMs ?? 3000;
  }

  /** Everything tapped here is on the server. */
  get settled(): boolean {
    return !this.hasPending() && !this.batches.size;
  }

  /** What the page shows: the server's counts plus this page's taps it doesn't have yet. */
  counts(): Counts {
    const c = { ...this.view.counters };
    for (const k of COUNTER_KEYS) {
      c[k] += this.pending[k];
      for (const b of this.batches.values()) c[k] += b.adds[k] ?? 0;
    }
    return c;
  }

  /**
   * A view from any reply (poll, juz tap, counter batch): kept only when it was
   * read after the one shown; its counts only when no batch is on its way.
   */
  apply(v: RoomView | undefined | null) {
    if (!v || v.slug !== this.view.slug) return;
    const rev = v.rev ?? 0;
    const parts = rev > this.rev.parts;
    const counters = rev > this.rev.counters && !this.batches.size;
    if (!parts && !counters) return;
    if (parts) this.rev.parts = rev;
    if (counters) this.rev.counters = rev;
    const shown = this.view.counters;
    const next = counters ? { ...shown } : shown;
    // Counters only grow: never show less than before, whatever the order of replies.
    if (counters) for (const k of COUNTER_KEYS) next[k] = Math.max(shown[k], v.counters?.[k] ?? 0);
    this.view = { ...(parts ? v : this.view), counters: next };
    this.io.changed();
  }

  /** One tap on a counter: shown now, sent with the next batch. */
  tap(counter: Counter) {
    this.pending[counter]++;
    this.io.changed();
    this.schedule(this.flushMs);
  }

  /**
   * Sends what's waiting: one batch at a time (the next one after its reply),
   * or with `now` (the page is being left or hidden) everything at once, with
   * keepalive so it arrives even if the page is closed.
   */
  flush(now = false) {
    clearTimeout(this.timer);
    this.timer = undefined;
    const busy = [...this.batches.values()].some((b) => b.sending);
    if (busy && !now) return;
    while (this.hasPending() && (now || !this.batches.size)) this.batches.set(newBatchId(), { adds: this.takePending(), sending: false });
    const todo = [...this.batches].filter(([, b]) => !b.sending);
    for (const [id, b] of now ? todo : todo.slice(0, 1)) void this.post(id, b, now);
  }

  /** The page is shown (again). */
  open() {
    this.closed = false;
    if (this.hasPending() || this.batches.size) this.schedule(0);
  }

  /** The page is gone: what's waiting is sent now, replies no longer matter. */
  close() {
    this.flush(true);
    this.closed = true;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private schedule(ms: number) {
    if (this.timer || this.closed) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.flush();
    }, ms);
  }

  private hasPending() {
    return COUNTER_KEYS.some((k) => this.pending[k] > 0);
  }

  private takePending(): Partial<Counts> {
    const adds: Partial<Counts> = {};
    for (const k of COUNTER_KEYS) {
      const n = Math.min(this.pending[k], MAX_ADD);
      if (n > 0) adds[k] = n;
      this.pending[k] -= n;
    }
    return adds;
  }

  private async post(id: string, b: Batch, keepalive: boolean) {
    b.sending = true;
    const r = await this.io.send({ action: "count", slug: this.view.slug, adds: b.adds, batch: id }, keepalive);
    b.sending = false;
    if (r === null || r.error === "rate_limited") {
      // Not reached, or the server is busy: the same batch (same id) again a little later.
      this.failures++;
      this.schedule(Math.min(60_000, this.retryMs * 2 ** Math.min(this.failures - 1, 5)));
      return;
    }
    this.failures = 0;
    // Confirmed (or refused for good: a page that no longer exists).
    this.batches.delete(id);
    if (r.ok) this.apply(r.view);
    this.io.changed();
    if (this.hasPending() || this.batches.size) this.schedule(this.flushMs);
  }
}
