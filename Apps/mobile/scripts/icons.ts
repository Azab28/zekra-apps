// Draws the phone app's icons and splash mark (Apps/mobile/assets) from the
// «ذِكرى» logo (src/lib/logo.ts), like scripts/dev/app-icons.ts does for the
// site. Run from the repo root (needs its @napi-rs/canvas): bun run icons (in Apps/mobile).
import { writeFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { drawLogo, logoWidth } from "../../../src/lib/images/brand";

const OUT = "Apps/mobile/assets";
const SIZE = 1024;

/** The mark `width` of the square wide, on white or transparent; `mono` paints it one flat colour. */
function draw({ width, background, light = false, mono }: { width: number; background?: string; light?: boolean; mono?: string }) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }
  drawLogo(ctx, SIZE / 2, SIZE / 2, (SIZE * width) / logoWidth(1), { light });
  if (mono) {
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = mono;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }
  return canvas.toBuffer("image/png");
}

// iOS rounds the corners itself.
writeFileSync(`${OUT}/icon.png`, draw({ width: 0.78, background: "#ffffff" }));
// Android adaptive icons: the launcher crops to its own shape, so the mark stays in the middle two thirds.
writeFileSync(`${OUT}/android-icon-foreground.png`, draw({ width: 0.56 }));
writeFileSync(`${OUT}/android-icon-monochrome.png`, draw({ width: 0.56, mono: "#ffffff" }));
writeFileSync(`${OUT}/splash-icon.png`, draw({ width: 0.9 }));
writeFileSync(`${OUT}/splash-icon-dark.png`, draw({ width: 0.9, light: true }));
console.log(`icons written to ${OUT}`);
