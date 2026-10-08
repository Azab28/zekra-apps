/** The offscreen document (Chrome, Edge): the audio engine, driven by the background's messages. */
import { handle, onReport } from "./lib/audio-engine";
import type { OffscreenCommand } from "./lib/radio";

onReport((r) => void chrome.runtime.sendMessage(r).catch(() => undefined));

chrome.runtime.onMessage.addListener((msg: OffscreenCommand, sender, reply) => {
  if (sender.id !== chrome.runtime.id || msg?.target !== "offscreen") return;
  reply(true);
  handle(msg);
});
