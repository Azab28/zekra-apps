/**
 * Where the background plays audio (Chrome, Edge): an offscreen document,
 * reached by messages. Firefox's build takes audio-host.firefox.ts instead
 * (scripts/build-extension.ts swaps it).
 */
import type { OffscreenCommand, OffscreenReport } from "./radio";

export async function ensureAudio() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: "Plays the Quran radio station or recitation the user picked.",
  });
}

/** A just-created document may not be listening yet: a few quick tries. */
export async function toAudio(cmd: OffscreenCommand) {
  for (let i = 0; ; i++) {
    try {
      return await chrome.runtime.sendMessage(cmd);
    } catch (err) {
      if (i >= 10) throw err;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

/** Whether anything is there to talk to (Chrome closes a silent document by itself). */
export const audioOpen = () => chrome.offscreen.hasDocument();

/** The document's reports come as runtime messages (background.ts listens for them). */
export const onAudioReport: (fn: (r: OffscreenReport) => void) => void = () => undefined;
