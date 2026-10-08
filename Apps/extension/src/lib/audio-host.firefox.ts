/**
 * Where the background plays audio in Firefox: its background is a page, so
 * the engine runs right there (no offscreen documents in Firefox). While
 * something plays, a cheap API call every 20 s keeps the event page from being
 * unloaded as idle.
 */
import { handle, onReport } from "./audio-engine";
import type { OffscreenCommand, OffscreenReport } from "./radio";

let keepAlive: ReturnType<typeof setInterval> | undefined;
const stay = (on: boolean) => {
  clearInterval(keepAlive);
  if (on) keepAlive = setInterval(() => void chrome.runtime.getPlatformInfo(), 20_000);
};

export async function ensureAudio() {}

export async function toAudio(cmd: OffscreenCommand) {
  if (cmd.type === "play" || cmd.type === "list" || cmd.type === "adhan") stay(true);
  else if (cmd.type === "stop" && !cmd.fade) stay(false);
  handle(cmd);
}

export const audioOpen = async () => true;

export function onAudioReport(fn: (r: OffscreenReport) => void) {
  onReport((r) => {
    if (r.type === "radio:ended") stay(false);
    fn(r);
  });
}
