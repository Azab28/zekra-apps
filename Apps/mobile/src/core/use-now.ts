import { useEffect, useState } from "react";
import { AppState } from "react-native";

/** The time, ticking every `ms` (and on coming back to the front), so countdowns stay current. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    const sub = AppState.addEventListener("change", (s) => s === "active" && setNow(Date.now()));
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [ms]);
  return now;
}
