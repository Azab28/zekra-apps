/** Room the floating bar and the mini player take at the bottom, so content scrolls clear of them. */
import { useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayer } from "@/core/player";

export const BAR_HEIGHT = 64;
export const BAR_GAP = 8;
export const MINI_HEIGHT = 58;

/** Pages with their own player controls or footer: the mini player stays off them. */
const NO_MINI = ["azkar", "mushaf", "player"];

/** The floating bar's bottom edge above the screen's. */
export function useBarBottom(): number {
  const insets = useSafeAreaInsets();
  return BAR_GAP + Math.max(insets.bottom - 4, 0);
}

/** Whether the mini player shows on this page. */
export function useMiniVisible(): boolean {
  const { track } = usePlayer();
  const segments = useSegments();
  return !!track && !NO_MINI.includes(segments[0] ?? "");
}

/** Room for the mini player at the bottom of this page (0 when it isn't shown). */
export function useMiniPlayerSpace(): number {
  return useMiniVisible() ? MINI_HEIGHT + 10 : 0;
}

/** Room to leave at the bottom of a tab's content: the bar, and the mini player above it. */
export function useBarSpace(): number {
  return useBarBottom() + BAR_HEIGHT + BAR_GAP + useMiniPlayerSpace();
}
