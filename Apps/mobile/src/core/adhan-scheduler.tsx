/**
 * Keeps the notifications scheduled (the adhan, azkar and the other
 * reminders) and the home-screen widget drawn — on opening the app, back in
 * the front, and whenever the place, the Hijri offset or the settings change —
 * and opens what a tapped notification points to (a page, or the Quran
 * alarm's recitation).
 */
import { router, type Href } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { stationTrack, surahTrack } from "./listen";
import { onNotificationOpen, reschedule } from "./notifications";
import { usePlayer } from "./player";
import { useStore } from "./store";
import { refreshWidget } from "./widget";

export function AdhanScheduler() {
  const { ready, prefs, settings, hijriOffset } = useStore();
  const player = usePlayer();
  const latest = useRef({ place: prefs.place, settings, hijriOffset, play: player.play });
  latest.current = { place: prefs.place, settings, hijriOffset, play: player.play };

  // Only what the notifications depend on (not the look).
  const key = JSON.stringify([prefs.place, settings.adhan, settings.madhab, settings.reminders, hijriOffset]);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => void reschedule(latest.current.place, latest.current.settings, latest.current.hijriOffset).catch(() => undefined), 600);
    return () => clearTimeout(timer);
  }, [ready, key]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void reschedule(latest.current.place, latest.current.settings, latest.current.hijriOffset).catch(() => undefined);
    });
    return () => sub.remove();
  }, []);

  // The home-screen widget: the place, madhab and Hijri offset it draws from, and a redraw (also on coming back).
  const widgetKey = JSON.stringify([prefs.place, settings.madhab, hijriOffset]);
  useEffect(() => {
    if (!ready) return;
    const draw = () => void refreshWidget({ place: latest.current.place, madhab: latest.current.settings.madhab, hijriOffset });
    draw();
    const sub = AppState.addEventListener("change", (s) => s === "active" && draw());
    return () => sub.remove();
  }, [ready, widgetKey, hijriOffset]);

  // A tapped notification: its page, or the Quran alarm's surah or station, playing.
  useEffect(() => {
    if (!ready) return;
    return onNotificationOpen(
      (url) => router.push(url as Href),
      () => {
        const { reminders, listen } = latest.current.settings;
        const t = reminders.alarm.play === "live" ? stationTrack(reminders.alarm.station) : surahTrack(listen, reminders.alarm.surah);
        if (t) latest.current.play(t);
        router.push("/player");
      },
    );
  }, [ready]);
  return null;
}
