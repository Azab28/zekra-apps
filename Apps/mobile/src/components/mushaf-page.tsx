/**
 * One page of the Madinah mushaf as the site draws it (/mushaf/[page]): the
 * printed lines from mushafPageRows in the page's own QCF V2 font, one font
 * size for the page so its widest line fills the frame (or the tajweed
 * edition's colour font, QCF V4, where the phone draws its colours), the surah headers in
 * the surah-name font and the basmala in page 1's. Each ayah's words can be
 * tapped; the selected and the recited ayah are highlighted.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Text, View, type LayoutChangeEvent } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { basmalaCodes, mushafPageRows, type PageRow } from "@lib/content/mushaf-pages";
import { DARK_STYLES, IMAGE_STYLES } from "@lib/image-styles";
import { loadNamesFont, loadPageFont, NAMES_FAMILY, pageFamily, TAJWEED_SUPPORTED } from "@/core/qcf-fonts";
import { surahName } from "@/core/quran";
import { useStore } from "@/core/store";
import { alpha, css } from "@/theme/colors";
import { QURAN_FONT } from "@/theme/fonts";
import { useTheme } from "@/theme/theme";
import { Button, T } from "./ui";

const MEASURE = 40;

/**
 * The paper and ink: the page look chosen in the settings (src/lib/image-styles.ts,
 * as the site's reading pref `pageStyle`); «كلاسيكي» is the site's classic page
 * in light and the theme's card in dark.
 */
function usePaper(tajweed: boolean) {
  const { dark: darkTheme, colors, raw } = useTheme();
  const { settings } = useStore();
  // The tajweed font's dark palette can't be picked here, so its colours go on a light page.
  const style = tajweed && DARK_STYLES.includes(settings.pageStyle) ? "classic" : settings.pageStyle;
  const dark = darkTheme && !tajweed;
  const look = style === "classic" ? null : IMAGE_STYLES[style].theme;
  const darkPage = look ? DARK_STYLES.includes(style) : dark;
  return {
    paper: look?.paper ?? (dark ? colors.card : IMAGE_STYLES.classic.theme.paper),
    ink: look?.ink ?? (dark ? colors.foreground : IMAGE_STYLES.classic.theme.ink),
    band: look?.band ?? css(alpha(raw.primary, 0.7)),
    gold: look?.gold ?? css(alpha(raw.gold, 0.6)),
    headerGold: look?.gold ?? css(alpha(raw.gold, 0.8)),
    headerFill: look?.headerFill ?? css(alpha(raw.primary, 0.05)),
    heading: look?.heading ?? (darkTheme && tajweed ? IMAGE_STYLES.classic.theme.heading : colors.primary),
    selected: darkPage ? "rgba(255,255,255,0.14)" : css(alpha(raw.primary, 0.15)),
    onAir: darkPage ? "rgba(217,193,140,0.2)" : css(alpha(raw.gold, 0.25)),
    muted: look?.muted ?? colors.mutedForeground,
  };
}

type Fonts = { page: boolean; names: boolean; basmala: boolean } | "error" | null;

export function MushafPage({ page, onAyah, selected, onAir }: { page: number; onAyah?: (index: number) => void; selected?: number | null; onAir?: number | null }) {
  const { settings } = useStore();
  const wantTajweed = settings.tajweed && TAJWEED_SUPPORTED;
  // The tajweed font failed to download: this page in the usual font.
  const [plain, setPlain] = useState(false);
  const tajweed = wantTajweed && !plain;
  const p = usePaper(tajweed);
  const rows = useMemo(() => mushafPageRows(page), [page]);
  const hasHeader = rows.some((r) => r.kind === "header");
  const hasBasmala = rows.some((r) => r.kind === "basmala");
  const [fonts, setFonts] = useState<Fonts>(null);
  const [attempt, setAttempt] = useState(0);
  const [inner, setInner] = useState(0);
  const [size, setSize] = useState(0);
  const widths = useRef<Map<number, number>>(new Map());
  const lines = rows.filter((r): r is Extract<PageRow, { kind: "line" }> => r.kind === "line");

  useEffect(() => {
    let alive = true;
    setFonts(null);
    setSize(0);
    widths.current = new Map();
    void (async () => {
      try {
        if (tajweed) await loadPageFont(page, true).catch(() => {
          if (alive) setPlain(true);
          throw new Error("tajweed");
        });
        else await loadPageFont(page);
        // The header and basmala fonts are extras: the page still shows without them.
        const [names, basmala] = await Promise.all([
          hasHeader ? loadNamesFont().then(() => true, () => false) : true,
          hasBasmala ? loadPageFont(1).then(() => true, () => false) : true,
        ]);
        if (alive) setFonts({ page: true, names, basmala });
      } catch (e) {
        // A failed tajweed font retries in the usual one (setPlain re-runs this).
        if (alive && !(e instanceof Error && e.message === "tajweed")) setFonts("error");
        return;
      }
      // The neighbours ahead of time, for turning pages offline.
      if (page < 604) void loadPageFont(page + 1, tajweed).catch(() => undefined);
      if (page > 1) void loadPageFont(page - 1, tajweed).catch(() => undefined);
    })();
    return () => {
      alive = false;
    };
  }, [page, hasHeader, hasBasmala, attempt, tajweed]);

  // Another page: try its tajweed font again.
  useEffect(() => setPlain(false), [page, wantTajweed]);

  const measured = (line: number, width: number) => {
    widths.current.set(line, width);
    if (widths.current.size === lines.length && inner > 0) {
      const widest = Math.max(...widths.current.values(), 1);
      setSize(Math.floor((MEASURE * inner) / widest) - 1);
    }
  };

  useEffect(() => {
    if (inner > 0 && widths.current.size === lines.length && lines.length) {
      const widest = Math.max(...widths.current.values(), 1);
      setSize(Math.floor((MEASURE * inner) / widest) - 1);
    }
  }, [inner, lines.length]);

  const onLayout = (e: LayoutChangeEvent) => setInner(Math.floor(e.nativeEvent.layout.width));
  const family = pageFamily(page, tajweed);
  const lineH = size * 1.85;
  const ready = fonts && fonts !== "error";

  return (
    <View style={{ borderRadius: 18, borderWidth: 3, borderColor: p.band, backgroundColor: p.paper, padding: 5 }}>
      <View style={{ borderRadius: 13, borderWidth: 1, borderColor: p.gold, paddingHorizontal: 10, paddingVertical: 14 }}>
        <View onLayout={onLayout} style={{ minHeight: size ? undefined : 420, justifyContent: "center" }}>
          {fonts === "error" ? (
            <View style={{ alignItems: "center", gap: 12, padding: 16 }}>
              <T color="mutedForeground" align="center">
                تعذّر تنزيل خط هذه الصفحة. تحتاج اتصالًا بالإنترنت أول مرة تفتح فيها الصفحة.
              </T>
              <Button label="حاول مرة أخرى" size="sm" variant="outline" onPress={() => setAttempt((a) => a + 1)} />
            </View>
          ) : !ready || !size ? (
            <ActivityIndicator color={p.heading} />
          ) : null}

          {/* Each line once at a known size, unseen, to fit the widest to the frame. */}
          {ready && !size && inner > 0 ? (
            <View style={{ position: "absolute", top: 0, start: 0, width: 5000, opacity: 0 }} pointerEvents="none">
              {lines.map((r) => (
                <Text
                  key={r.line}
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={{ fontFamily: family, fontSize: MEASURE, alignSelf: "flex-start" }}
                  onTextLayout={(e) => measured(r.line, e.nativeEvent.lines.reduce((w, l) => Math.max(w, l.width), 0))}
                >
                  {r.segments.map((s) => s.codes).join("")}
                </Text>
              ))}
            </View>
          ) : null}

          {ready && size > 0
            ? rows.map((r, i) => {
                if (r.kind === "header") {
                  return (
                    <View
                      key={`h${i}`}
                      style={{ height: size * 1.7, marginVertical: 4, borderRadius: 12, borderWidth: 2, borderColor: p.headerGold, backgroundColor: p.headerFill, alignItems: "center", justifyContent: "center" }}
                    >
                      {fonts.names ? (
                        // «سورة» and the name as two glyphs: in one string the font puts «سورة» after the name.
                        <View style={{ flexDirection: "row", direction: "rtl", alignItems: "center", gap: size * 0.12 }}>
                          <Text allowFontScaling={false} style={{ fontFamily: NAMES_FAMILY, fontSize: size * 1.4, color: p.heading }}>
                            surah
                          </Text>
                          <Text allowFontScaling={false} style={{ fontFamily: NAMES_FAMILY, fontSize: size * 1.4, color: p.heading }}>
                            {String(r.surah).padStart(3, "0")}
                          </Text>
                        </View>
                      ) : (
                        <Text allowFontScaling={false} style={{ fontFamily: QURAN_FONT, fontSize: size * 0.95, color: p.heading }}>
                          سورة {surahName(r.surah)}
                        </Text>
                      )}
                    </View>
                  );
                }
                if (r.kind === "basmala") {
                  return fonts.basmala ? (
                    <Text
                      key={`b${i}`}
                      allowFontScaling={false}
                      numberOfLines={1}
                      ellipsizeMode="clip"
                      style={{ fontFamily: pageFamily(1), fontSize: size * 0.9, lineHeight: lineH, height: lineH, textAlign: "center", color: p.ink }}
                    >
                      {basmalaCodes()}
                    </Text>
                  ) : null;
                }
                return (
                  <Text
                    key={`l${r.line}`}
                    allowFontScaling={false}
                    numberOfLines={1}
                    ellipsizeMode="clip"
                    style={{ fontFamily: family, fontSize: size, lineHeight: lineH, height: lineH, textAlign: "center", color: p.ink }}
                  >
                    {r.segments.map((s, j) => (
                      <Text
                        key={j}
                        onPress={onAyah ? () => onAyah(s.index) : undefined}
                        style={selected === s.index ? { backgroundColor: p.selected } : onAir === s.index ? { backgroundColor: p.onAir } : undefined}
                      >
                        {s.codes}
                      </Text>
                    ))}
                  </Text>
                );
              })
            : null}
        </View>
        <Text allowFontScaling={false} style={{ marginTop: 6, textAlign: "center", color: p.muted, fontFamily: "Plex-Regular", fontSize: 13 }}>
          {toArabicDigits(page)}
          {wantTajweed && plain ? " · تعذّر تنزيل خط التجويد لهذه الصفحة" : ""}
        </Text>
      </View>
    </View>
  );
}
