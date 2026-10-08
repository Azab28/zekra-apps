/**
 * «نسخ ومشاركة»: a range of ayat as text (with التفسير الميسر if wanted) or as
 * an image drawn here on a canvas with the mushaf's page fonts, in the site's
 * image looks (src/lib/image-styles.ts) and the usual post sizes.
 */
import { IMAGE_STYLES, type ImageStyleId } from "../../../../src/lib/image-styles";
import { fill, h, icon, modal, toast } from "../lib/dom";
import { loadPage, pageFamily } from "../lib/fonts";
import { ayahAt, ayatOf, loadTafsir, rangeLabel, SURAHS, type AyahView, type Range } from "../lib/quran";
import { n } from "../lib/times";

type Size = "auto" | "square" | "story" | "portrait" | "wide";
const SIZES: [Size, string, string, number | null][] = [
  ["auto", "تلقائي", "يتمدد حسب المحتوى", null],
  ["square", "مربع 1:1", "Instagram · Facebook · LinkedIn", 1],
  ["story", "ستوري 9:16", "الاستوري · حالة WhatsApp", 16 / 9],
  ["portrait", "طولي 4:5", "تايم لاين Instagram", 5 / 4],
  ["wide", "عرضي 16:9", "LinkedIn · X تايم لاين", 9 / 16],
];
const MAX_AYAT = 30;
const SITE_HOST = new URL(__SITE__).host;

const opts = { kind: "image" as "text" | "image", tafsir: false, style: "classic" as ImageStyleId, size: "auto" as Size, scale: 2 };

export function openShare(view: Range) {
  const { s } = ayahAt(view.start);
  const [name, count, , first] = SURAHS[s - 1];
  let range: Range = { ...view };
  const body = h("div", { class: "share" });
  const preview = h("div", { class: "share-preview" });
  let lastCanvas: HTMLCanvasElement | null = null;
  let lastText = "";

  const ayahSelect = (value: number, onchange: (v: number) => void) => {
    const el = h(
      "select",
      { class: "field", onchange: (e: Event) => onchange(Number((e.target as HTMLSelectElement).value)) },
      ...Array.from({ length: count }, (_, k) => h("option", { value: String(first + k) }, n(k + 1))),
    );
    el.value = String(value);
    return el;
  };
  const select = <T extends string | number>(label: string, value: T, options: [T, string][], set: (v: T) => void) => {
    const el = h(
      "select",
      { class: "field", onchange: (e: Event) => (set(options.find((o) => String(o[0]) === (e.target as HTMLSelectElement).value)![0]), draw()) },
      ...options.map(([v, l]) => h("option", { value: String(v) }, l)),
    );
    el.value = String(value);
    return h("label", { class: "set-field" }, label, el);
  };

  const draw = () => {
    fill(
      body,
      h("div", { class: "pop-sub" }, "نطاق الآيات"),
      h(
        "div",
        { class: "set-box form-grid two" },
        h("label", { class: "set-field" }, "من الآية", ayahSelect(range.start, (v) => ((range = { start: v, end: Math.max(v, Math.min(range.end, v + MAX_AYAT - 1)) }), draw()))),
        h("label", { class: "set-field" }, "إلى الآية", ayahSelect(range.end, (v) => ((range = { start: Math.min(range.start, v), end: v }), clampRange(), draw()))),
      ),
      h("div", { class: "pop-sub" }, "خيارات المشاركة"),
      h(
        "div",
        { class: "set-box" },
        h(
          "div",
          { class: "set-row" },
          h("span", null, "النوع"),
          h(
            "div",
            { class: "radios", role: "radiogroup" },
            ...([["text", "نص"], ["image", "صورة"]] as const).map(([v, l]) =>
              h("label", { class: "radio" }, h("input", { type: "radio", name: "share-kind", checked: opts.kind === v, onchange: () => ((opts.kind = v), draw()) }), l),
            ),
          ),
        ),
        opts.kind === "text"
          ? h("div", { class: "form-grid two" }, select("المحتوى", opts.tafsir ? "t" : "", [["", "الآيات فقط"], ["t", "مع التفسير الميسر"]], (v) => (opts.tafsir = v === "t")))
          : h(
              "div",
              { class: "form-grid two" },
              select("المظهر", opts.style, Object.entries(IMAGE_STYLES).map(([k, v]) => [k as ImageStyleId, v.label]), (v) => (opts.style = v)),
              select("المقاس", opts.size, SIZES.map(([k, l, d]) => [k, `${l} — ${d}`] as [Size, string]), (v) => (opts.size = v)),
              select("الدقة", opts.scale, [[1, "عادية"], [2, "عالية (ريتنا)"]], (v) => (opts.scale = v)),
            ),
      ),
      h("div", { class: "share-sep" }, h("span", null, "معاينة")),
      preview,
    );
    void drawPreview();
  };

  const clampRange = () => {
    if (range.end - range.start + 1 > MAX_AYAT) {
      range = { start: range.end - MAX_AYAT + 1, end: range.end };
      toast(`حتى ${n(MAX_AYAT)} آية في المرة`);
    }
  };

  const drawPreview = async () => {
    const ayat = await ayatOf(range);
    if (opts.kind === "text") {
      lastText = await asText(ayat, range, opts.tafsir);
      lastCanvas = null;
      fill(preview, h("pre", { class: "share-text" }, lastText));
    } else {
      fill(preview, h("div", { class: "muted" }, "جارٍ الرسم…"));
      lastCanvas = await asImage(ayat, range, opts.style, opts.size, opts.scale).catch(() => null);
      fill(preview, lastCanvas ? lastCanvas : h("p", { class: "muted" }, "تعذّر رسم الصورة (خطوط المصحف تحتاج اتصالًا أول مرة)."));
    }
  };

  const fileName = () => `${name}-${n(ayahAt(range.start).a)}-${n(ayahAt(range.end).a)}`.replace(/\s+/g, "-");
  const blob = () => new Promise<Blob | null>((r) => (lastCanvas ? lastCanvas.toBlob(r, "image/png") : r(null)));

  const copy = async () => {
    try {
      if (opts.kind === "text") await navigator.clipboard.writeText(lastText);
      else {
        const b = await blob();
        if (!b) return;
        await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]);
      }
      toast("نُسخ");
    } catch {
      toast("تعذّر النسخ");
    }
  };
  const download = async () => {
    const b = opts.kind === "text" ? new Blob([lastText], { type: "text/plain;charset=utf-8" }) : await blob();
    if (!b) return;
    const a = h("a", { href: URL.createObjectURL(b), download: `${fileName()}.${opts.kind === "text" ? "txt" : "png"}` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };
  const share = async () => {
    try {
      if (opts.kind === "text") {
        if (!navigator.share) return copy();
        await navigator.share({ text: lastText });
      } else {
        const b = await blob();
        if (!b) return;
        const file = new File([b], `${fileName()}.png`, { type: "image/png" });
        if (!navigator.canShare?.({ files: [file] })) return copy();
        await navigator.share({ files: [file] });
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast("تعذّرت المشاركة");
    }
  };

  draw();
  modal(`نسخ آيات من سورة ${name}`, body, {
    cls: "share-modal",
    footer: h(
      "div",
      { class: "row end" },
      h("button", { type: "button", class: "btn", onclick: share }, icon("share-2"), "مشاركة"),
      h("button", { type: "button", class: "btn", onclick: copy }, icon("copy"), "نسخ"),
      h("button", { type: "button", class: "btn primary", onclick: download }, icon("download"), "تحميل"),
    ),
  });
}

async function asText(ayat: AyahView[], range: Range, withTafsir: boolean): Promise<string> {
  const body = ayat.map((a) => `${a.text} (${n(a.a)})`).join(" ");
  let out = `﴿ ${body} ﴾\n[سورة ${rangeLabel(range, n)}]`;
  if (withTafsir) {
    const t = await loadTafsir();
    out += `\n\nالتفسير الميسر:\n${ayat.map((a) => `(${n(a.a)}) ${t[a.i] ?? ""}`).join("\n")}`;
  }
  return out;
}

type Token = { text: string; family: string; gap: boolean };

/** The ayat as a picture: a framed page with the surah's name, the words re-flowed, the reference and the site. */
async function asImage(ayat: AyahView[], range: Range, styleId: ImageStyleId, size: Size, scale: number): Promise<HTMLCanvasElement> {
  const t = IMAGE_STYLES[styleId].theme;
  const pages = [...new Set(ayat.flatMap((a) => a.lines.map((l) => l[0])))];
  await Promise.all([...pages.map(loadPage), document.fonts.load('700 40px "Amiri"'), document.fonts.load('400 30px "IBM Plex Sans Arabic"')]);
  // Each glyph is a word; a printed line's end is a word gap.
  const tokens: Token[] = ayat.flatMap((a) =>
    a.lines.flatMap(([page, , codes]) => [...codes].map((c, k, all) => ({ text: c, family: pageFamily(page), gap: k === all.length - 1 }))),
  );
  const ratio = SIZES.find((x) => x[0] === size)![3];
  const W = (size === "wide" ? 1920 : size === "auto" ? 1600 : 1080) * scale;
  const fixedH = ratio ? Math.round(W * ratio) : null;
  const pad = W * 0.07;
  const innerW = W - pad * 2 - W * 0.06;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const layout = (fs: number) => {
    const lines: { tokens: Token[]; width: number }[] = [];
    let cur: Token[] = [];
    let width = 0;
    const gap = fs * 0.28;
    for (const tok of tokens) {
      ctx.font = `${fs}px "${tok.family}"`;
      const w = ctx.measureText(tok.text).width + (tok.gap ? gap : 0);
      if (cur.length && width + w > innerW) {
        lines.push({ tokens: cur, width });
        cur = [];
        width = 0;
      }
      cur.push(tok);
      width += w;
    }
    if (cur.length) lines.push({ tokens: cur, width });
    return { lines, lineH: fs * 1.9, gap };
  };

  const headH = W * 0.11;
  const footH = W * 0.09;
  let fs = 64 * scale * (size === "wide" ? 1.15 : 1);
  let lay = layout(fs);
  if (fixedH) {
    // Shrink until the text fits the chosen size (or grow a short passage up to a limit).
    const room = fixedH - pad * 2 - headH - footH;
    while (lay.lines.length * lay.lineH > room && fs > 18 * scale) lay = layout((fs *= 0.92));
    while (lay.lines.length * lay.lineH < room * 0.55 && fs < 110 * scale) {
      const bigger = layout(fs * 1.08);
      if (bigger.lines.length * bigger.lineH > room) break;
      lay = bigger;
      fs *= 1.08;
    }
  }
  const textH = lay.lines.length * lay.lineH;
  const H = fixedH ?? Math.round(pad * 2 + headH + textH + footH + W * 0.04);
  canvas.width = W;
  canvas.height = H;

  // The page and its frame.
  ctx.fillStyle = t.band;
  ctx.fillRect(0, 0, W, H);
  const m = W * 0.022;
  ctx.fillStyle = t.paper;
  ctx.fillRect(m, m, W - m * 2, H - m * 2);
  ctx.strokeStyle = t.gold;
  ctx.lineWidth = Math.max(2, W * 0.003);
  ctx.strokeRect(m * 1.8, m * 1.8, W - m * 3.6, H - m * 3.6);

  // The surah's name in a framed band.
  const { s } = ayahAt(range.start);
  const bandW = W * 0.5;
  const bandH = headH * 0.62;
  const bx = (W - bandW) / 2;
  const by = pad;
  ctx.fillStyle = t.headerFill;
  ctx.beginPath();
  ctx.roundRect(bx, by, bandW, bandH, bandH / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = t.heading;
  ctx.font = `700 ${bandH * 0.52}px "Amiri"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  ctx.fillText(`سورة ${SURAHS[s - 1][0]}`, W / 2, by + bandH / 2 + bandH * 0.04);

  // The words, right to left, each line centred.
  ctx.fillStyle = t.ink;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.direction = "ltr";
  const top = fixedH ? pad + headH + ((fixedH - pad * 2 - headH - footH) - textH) / 2 : pad + headH + W * 0.02;
  lay.lines.forEach((line, k) => {
    let x = (W + line.width) / 2;
    const y = top + lay.lineH * (k + 0.72);
    for (const tok of line.tokens) {
      ctx.font = `${fs}px "${tok.family}"`;
      const w = ctx.measureText(tok.text).width;
      x -= w;
      ctx.fillText(tok.text, x, y);
      if (tok.gap) x -= lay.gap;
    }
  });

  // The reference and the site.
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = t.heading;
  ctx.font = `700 ${W * 0.026}px "Amiri"`;
  ctx.fillText(`[سورة ${rangeLabel(range, n)}]`, W / 2, H - pad - footH * 0.45);
  ctx.fillStyle = t.muted;
  ctx.font = `400 ${W * 0.016}px "IBM Plex Sans Arabic"`;
  ctx.fillText(`ذِكرى · ${SITE_HOST}`, W / 2, H - pad * 0.75);
  return canvas;
}
