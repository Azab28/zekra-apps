// src/lib/room-sync.ts's API, for the app's typecheck only (tsconfig paths): it imports its types from
// khatma-room.ts, which reads the database (see khatma-room.d.ts). The app runs the real module unchanged.
import type { RoomView } from "./khatma-room";

export type Counts = RoomView["counters"];
export type Counter = keyof Counts;
export declare const COUNTER_KEYS: readonly Counter[];
export type CountBody = { action: "count"; slug: string; adds: Partial<Counts>; batch: string };
export type SyncReply = { ok: boolean; view?: RoomView; error?: string } | null;

export declare class RoomSync {
  view: RoomView;
  constructor(
    initial: RoomView,
    io: { send: (body: CountBody, keepalive: boolean) => Promise<SyncReply>; changed: () => void; flushMs?: number; retryMs?: number },
  );
  get settled(): boolean;
  counts(): Counts;
  apply(v: RoomView | undefined | null): void;
  tap(counter: Counter): void;
  flush(now?: boolean): void;
  open(): void;
  close(): void;
}
