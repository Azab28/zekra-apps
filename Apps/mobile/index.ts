// The app's entry: expo-router, and on Android builds the home-screen widget's background task (src/widget).
import "expo-router/entry";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

if (Platform.OS === "android" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
  const { registerWidgetTaskHandler } = require("react-native-android-widget") as typeof import("react-native-android-widget");
  registerWidgetTaskHandler(require("./src/widget/handler").widgetTaskHandler);
}
