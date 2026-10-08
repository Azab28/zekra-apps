// The client-facing types of src/lib/khatma-room.ts, for the app's typecheck only (tsconfig paths): the
// module itself reads the database, which would pull the server's whole graph into the app's typecheck.
// Keep in step with it; at runtime the app only sends and reads these as JSON.
export type Progress = { done: number; taken: number; free: number };
export type RoomPart = { juz: number; name: string; done: boolean; mine: boolean };
export type RoomView = {
  slug: string;
  kind: "group" | "memorial";
  heading: string;
  round: number;
  parts: RoomPart[];
  progress: Progress;
  counters: { tasbeeh: number; istighfar: number; salawat: number; surahs: number };
  inTelegramGroup: boolean;
  honoree: { name: string; female: boolean } | null;
  rev: number;
};
export type MyRoom = {
  slug: string;
  kind: "group" | "memorial";
  heading: string;
  round: number;
  done: number;
  created: boolean;
  taken: number;
  finished: number;
  at: number;
};
