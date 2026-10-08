/** Recitations saved on the device for offline listening: each with its surahs and the space it takes, to open or delete. */
import { router } from "expo-router";
import { View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { ChevronLeft, HardDriveDownload, Trash } from "@/components/icons";
import { Screen } from "@/components/screen";
import { useDialogs } from "@/components/sheet";
import { Button, Card, IconButton, ListRow, Row, T } from "@/components/ui";
import { removeMoshaf, savedRecitations, sizeLabel, useDownloads } from "@/core/downloads";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;

export default function Downloads() {
  useDownloads();
  const { colors } = useTheme();
  const dialogs = useDialogs();
  const list = savedRecitations();
  const total = list.reduce((sum, r) => sum + r.bytes, 0);

  const remove = async (moshafId: number, name: string) => {
    const ok = await dialogs.confirm({ title: `حذف تلاوة ${name} من الجهاز؟`, message: "تبقى متاحة للاستماع عبر الإنترنت.", confirm: "احذف", danger: true });
    if (ok) removeMoshaf(moshafId);
  };

  return (
    <Screen back title="التنزيلات">
      {list.length === 0 ? (
        <Card style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
          <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
            <HardDriveDownload size={28} color={colors.primary} />
          </View>
          <T color="mutedForeground" align="center">
            لا توجد تلاوات محفوظة بعد. افتح قارئًا واضغط زر التحميل بجانب السورة، أو «تحميل الكل»، لتسمعها بلا إنترنت.
          </T>
          <Button label="التلاوات" variant="outline" onPress={() => router.push("/recitations")} />
        </Card>
      ) : (
        <>
          <T size={13} color="mutedForeground">
            {n(list.length)} تلاوة على الجهاز · {sizeLabel(total, n)}
          </T>
          <Card padded={false} style={{ overflow: "hidden" }}>
            {list.map((r, i) => (
              <ListRow
                key={r.moshafId}
                icon={HardDriveDownload}
                title={r.reciter}
                note={`${r.moshaf} · ${n(r.saved.length)} سورة · ${sizeLabel(r.bytes, n)}`}
                onPress={() => router.push({ pathname: "/recitations/[id]", params: { id: String(r.reciterId) } })}
                last={i === list.length - 1}
                trailing={
                  <Row gap={4}>
                    <IconButton icon={Trash} label={`حذف ${r.reciter}`} onPress={() => void remove(r.moshafId, r.reciter)} size={34} tone="plain" />
                    <ChevronLeft size={18} color={colors.mutedForeground} />
                  </Row>
                }
              />
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
