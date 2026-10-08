/**
 * The app is Arabic, right to left, in Expo Go too (where the native side is
 * left to right): the root view sets `direction: "rtl"` and text aligns to
 * START. A build with forcesRTL (app.json) is right to left natively, where RN
 * swaps "left" and "right", hence the check.
 */
import { I18nManager } from "react-native";

/** textAlign for the start of a line (the right). */
export const START = I18nManager.isRTL ? "left" : "right";
/** textAlign for the end of a line (the left). */
export const END = I18nManager.isRTL ? "right" : "left";
