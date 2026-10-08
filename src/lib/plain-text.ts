/**
 * Client-safe: labels shared with the bot carry emoji; the site and dashboard
 * show icons (SVG) instead, so they drop them.
 */
export const withoutEmoji = (s: string) =>
  s
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️‍⃣]+/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
