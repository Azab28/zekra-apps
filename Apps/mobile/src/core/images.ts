/**
 * An ayah or a mushaf page as an image or a phone wallpaper, drawn by the
 * site (/api/mushaf-image, the bot's mushaf renderer) in the look chosen in
 * the settings, saved into the cache and handed to the share sheet (save to
 * the photos, set as wallpaper, send). No photo-library permission needed.
 */
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Dimensions, PixelRatio } from "react-native";
import { DEFAULT_IMAGE_STYLE, type ImageStyleId } from "@lib/image-styles";
import { fitWall } from "@lib/wall-size";
import { SITE_URL } from "./site";

export type ImageTarget = { ayah: number } | { page: number };
export type ImageKind = "image" | "wallpaper";

/** This phone's screen in real pixels (the wallpaper's size). */
function screenSize() {
  const { width, height } = Dimensions.get("screen");
  const r = PixelRatio.get();
  return fitWall(Math.round(width * r), Math.round(height * r));
}

export function imageUrl(target: ImageTarget, kind: ImageKind, style: ImageStyleId): string {
  const q = new URLSearchParams("ayah" in target ? { ayah: String(target.ayah) } : { page: String(target.page) });
  if (kind === "image") q.set("format", "image");
  else {
    const s = screenSize();
    q.set("format", "wallpaper");
    q.set("w", String(s.w));
    q.set("h", String(s.h));
    // The wallpapers' current design (as the site's ImageActions).
    q.set("v", "2");
  }
  if (style !== DEFAULT_IMAGE_STYLE) q.set("style", style);
  return `${SITE_URL}/api/mushaf-image?${q}`;
}

/** Downloads the image and opens the share sheet; an Arabic message when it failed. */
export function shareImage(target: ImageTarget, kind: ImageKind, style: ImageStyleId, title: string): Promise<string | null> {
  const name = `${"ayah" in target ? `ayah-${target.ayah}` : `page-${target.page}`}-${kind}-${style}`;
  return shareRemoteImage(imageUrl(target, kind, style), name, title);
}

/**
 * Any of the site's images (/api/prayer-card, /api/imsakiya, …) into the share
 * sheet; `name` (no extension) is its file in the cache, reused when `keep`.
 */
export async function shareRemoteImage(url: string, name: string, title: string, keep = true): Promise<string | null> {
  try {
    const dir = new Directory(Paths.cache, "images");
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const file = new File(dir, `${name.replace(/[^\w.-]+/g, "-")}.png`);
    if (file.exists && !keep) file.delete();
    if (!file.exists) {
      await File.downloadFileAsync(url, file, { idempotent: true });
      // A refusal (busy, too many requests) is a short text, not a picture.
      if ((file.size ?? 0) < 2048) {
        file.delete();
        return "الموقع مشغول الآن، حاول بعد قليل.";
      }
    }
    if (!(await Sharing.isAvailableAsync())) return "المشاركة غير متاحة على هذا الجهاز.";
    await Sharing.shareAsync(file.uri, { mimeType: "image/png", dialogTitle: title, UTI: "public.png" });
    return null;
  } catch {
    return "تعذّر تجهيز الصورة. تأكّد من الإنترنت وحاول مرة أخرى.";
  }
}
