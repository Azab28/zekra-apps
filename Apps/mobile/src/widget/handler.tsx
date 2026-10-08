/** The widget's background task (index.ts registers it on Android builds): draws it from the snapshot the app saved. */
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { readJson } from "@/core/storage";
import { WIDGET_KEY, widgetModel, type WidgetSnapshot } from "./model";
import { renderPrayerWidget } from "./prayer-widget";

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetAction === "WIDGET_DELETED" || props.widgetAction === "WIDGET_CLICK") return;
  const snapshot = await readJson<WidgetSnapshot>(WIDGET_KEY);
  props.renderWidget(renderPrayerWidget(widgetModel(snapshot)));
}
