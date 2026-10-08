/**
 * The site's PDFs (/download): the mushaf whole, a juz, a surah or a page
 * range (/pdf/juz-N.pdf, surah-N, pages-A-B, /mushaf.pdf, cut from the
 * per-juz files on the server), and the morning/evening booklet
 * (/booklet.pdf). Downloaded into the cache with progress, then handed to the
 * share sheet (open in a PDF reader, save to the files, send).
 */
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { SITE_URL } from "./site";

export type PdfProgress = (share: number) => void;

/** The file starts with «%PDF» (read without loading a 300 MB mushaf into memory). */
function isPdf(file: File): boolean {
  const h = file.open();
  try {
    return String.fromCharCode(...h.readBytes(4)) === "%PDF";
  } finally {
    h.close();
  }
}

/** Downloads `path` as `name`.pdf (kept for next time) and shares it; an Arabic message when it failed. */
export async function sharePdf(path: string, name: string, title: string, onProgress?: PdfProgress, signal?: AbortSignal): Promise<string | null> {
  const dir = new Directory(Paths.cache, "pdf");
  const file = new File(dir, `${name}.pdf`);
  const part = new File(dir, `${name}.pdf.part`);
  try {
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    if (!file.exists) {
      await File.downloadFileAsync(SITE_URL + path, part, {
        idempotent: true,
        signal,
        onProgress: ({ bytesWritten, totalBytes }) => totalBytes > 0 && onProgress?.(bytesWritten / totalBytes),
      });
      // Not built on the server yet (503), or refused: not a PDF.
      if (!isPdf(part)) {
        part.delete();
        return "الملف غير جاهز على الموقع الآن، حاول لاحقًا.";
      }
      part.moveSync(file);
    }
    if (!(await Sharing.isAvailableAsync())) return "المشاركة غير متاحة على هذا الجهاز.";
    await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: title, UTI: "com.adobe.pdf" });
    return null;
  } catch {
    if (part.exists) part.delete();
    return signal?.aborted ? null : "تعذّر تنزيل الملف. تأكّد من الإنترنت وحاول مرة أخرى.";
  }
}
