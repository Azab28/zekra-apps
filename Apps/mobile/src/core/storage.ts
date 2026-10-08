/** JSON values kept on the device (AsyncStorage). Reads never throw: a missing or broken value is null. */
import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "zekra:";

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw == null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // A full or unavailable storage only loses this save; the app keeps working.
  }
}
