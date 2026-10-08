/** The app's root: stored state, the look, our dialogs, fonts; right to left from here down. */
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AccountNotice } from "@/components/account-notice";
import { MiniPlayer } from "@/components/mini-player";
import { DialogProvider } from "@/components/sheet";
import { AdhanScheduler } from "@/core/adhan-scheduler";
import { PlayerProvider } from "@/core/player";
import { StoreProvider, useStore } from "@/core/store";
import { FONT_FILES } from "@/theme/fonts";
import { ThemeProvider, useTheme } from "@/theme/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <ThemeProvider>
          <PlayerProvider>
            <DialogProvider>
              <Root />
            </DialogProvider>
          </PlayerProvider>
        </ThemeProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { ready } = useStore();
  const { colors, dark } = useTheme();
  const [fonts, fontError] = useFonts(FONT_FILES);
  const loaded = ready && (fonts || !!fontError);

  useEffect(() => {
    if (loaded) SplashScreen.hide();
  }, [loaded]);
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  const navTheme = useMemo(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, background: colors.background, card: colors.card, text: colors.foreground, border: colors.border, primary: colors.primary } };
  }, [dark, colors]);

  if (!loaded) return null;
  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={dark ? "light" : "dark"} />
      <View style={{ flex: 1, direction: "rtl", backgroundColor: colors.background }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="player" options={{ animation: "slide_from_bottom" }} />
        </Stack>
        <MiniPlayer />
        <AdhanScheduler />
        <AccountNotice />
      </View>
    </NavThemeProvider>
  );
}
