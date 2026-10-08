/**
 * Keeps the home-screen widget (src/widget) in step: the app saves what it
 * needs (`widget` in storage) and asks Android to redraw it. Android builds
 * only: the widget library's native module isn't in Expo Go, and it's
 * required here only when used.
 */
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { WIDGET_KEY, WIDGET_NAME, widgetModel, type WidgetSnapshot } from "@/widget/model";
import { writeJson } from "./storage";

export const widgetSupported = Platform.OS === "android" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

export async function refreshWidget(snapshot: WidgetSnapshot) {
  await writeJson(WIDGET_KEY, snapshot);
  if (!widgetSupported) return;
  try {
    const { requestWidgetUpdate } = require("react-native-android-widget") as typeof import("react-native-android-widget");
    const { renderPrayerWidget } = require("@/widget/prayer-widget") as typeof import("@/widget/prayer-widget");
    await requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: () => renderPrayerWidget(widgetModel(snapshot)) });
  } catch {
    // No widget on the home screen, or an older build without it.
  }
}
