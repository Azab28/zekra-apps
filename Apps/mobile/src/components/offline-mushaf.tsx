/**
 * «المصحف بلا إنترنت»: how many of the 604 page fonts are on the phone, and
 * downloading the rest at once (core/qcf-fonts.ts), in the edition the
 * settings show (tajweed or not).
 */
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { downloadAllPages, savedPages, TAJWEED_SUPPORTED } from "@/core/qcf-fonts";
import { useStore } from "@/core/store";
import { useTheme } from "@/theme/theme";
import { CircleCheck, CircleX, HardDriveDownload } from "./icons";
import { Button, Card, Row, T } from "./ui";

const n = toArabicDigits;

export function OfflineMushaf() {
  const { colors } = useTheme();
  const { settings } = useStore();
  const tajweed = settings.tajweed && TAJWEED_SUPPORTED;
  const [saved, setSaved] = useState(() => savedPages(tajweed));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(0);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => setSaved(savedPages(tajweed)), [tajweed]);
  useEffect(() => () => abort.current?.abort(), []);

  const start = async () => {
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setFailed(0);
    const bad = await downloadAllPages(tajweed, (done) => setSaved(done), ctrl.signal);
    setBusy(false);
    setFailed(bad);
    setSaved(savedPages(tajweed));
  };

  const all = saved >= 604;
  return (
    <Card style={{ gap: 10 }}>
      <Row gap={10}>
        {all ? <CircleCheck size={20} color={colors.primary} /> : <HardDriveDownload size={20} color={colors.primary} />}
        <View style={{ flex: 1 }}>
          <T weight="semibold">المصحف بلا إنترنت{tajweed ? " (التجويد)" : ""}</T>
          <T size={13} color="mutedForeground">
            {all ? "كل الصفحات محفوظة على جهازك" : `محفوظ ${n(saved)} من ٦٠٤ صفحة. الصفحات تُحفظ أيضًا كلما فتحتها.`}
          </T>
        </View>
      </Row>
      {busy ? (
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.muted, overflow: "hidden" }}>
          <View style={{ height: 6, width: `${(saved / 604) * 100}%`, backgroundColor: colors.primary }} />
        </View>
      ) : null}
      {failed > 0 && !busy ? (
        <T size={13} color="destructive">
          تعذّر تنزيل {n(failed)} صفحة؛ حاول مرة أخرى.
        </T>
      ) : null}
      {all ? null : busy ? (
        <Button label="إيقاف" icon={CircleX} size="sm" variant="outline" onPress={() => abort.current?.abort()} />
      ) : (
        <Button label="نزّل المصحف كاملًا (حجمه كبير، يُفضّل واي فاي)" icon={HardDriveDownload} size="sm" variant="outline" onPress={() => void start()} />
      )}
    </Card>
  );
}
