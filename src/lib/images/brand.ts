/**
 * The «ذِكرى» logo (src/lib/logo.ts) on a canvas: in its own colours (on
 * white), or `light` — a cream ribbon with the gold crescent and star — for the
 * images' dark green backgrounds.
 */
import { Path2D, type SKRSContext2D } from "@napi-rs/canvas";
import { LOGO_GOLD, LOGO_GOLD_PATH, LOGO_GREEN, LOGO_GREEN_PATH, LOGO_VIEWBOX as V } from "../logo";

const LIGHT_RIBBON = ["#fffaf0", "#f3ead2", "#ddd0ae"] as const;

function gradient(ctx: SKRSContext2D, [x1, y1, x2, y2]: number[], stops: readonly string[]) {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  // The same stops as the SVG (src/components/logo.tsx).
  [0, 0.48, 1].forEach((offset, i) => g.addColorStop(offset, stops[i]));
  return g;
}

/** Width of the logo drawn `height` tall. */
export const logoWidth = (height: number) => (height * V.w) / V.h;

/** Draws the logo `height` tall, centred on (cx, cy). */
export function drawLogo(ctx: SKRSContext2D, cx: number, cy: number, height: number, { light = false } = {}) {
  const k = height / V.h;
  ctx.save();
  ctx.translate(cx - (V.w * k) / 2 - V.x * k, cy - height / 2 - V.y * k);
  ctx.scale(k, k);
  ctx.fillStyle = gradient(ctx, [180, 150, 1050, 1080], light ? LIGHT_RIBBON : LOGO_GREEN);
  ctx.fill(new Path2D(LOGO_GREEN_PATH), "evenodd");
  ctx.fillStyle = gradient(ctx, [150, 250, 1100, 700], LOGO_GOLD);
  ctx.fill(new Path2D(LOGO_GOLD_PATH), "evenodd");
  ctx.restore();
}
