/** One shared khatma or «صدقة جارية» page, as the site's /k/<slug> (components/room.tsx). */
import { useLocalSearchParams } from "expo-router";
import { Room, useRoom } from "@/components/room";
import { Screen } from "@/components/screen";
import { Card, T } from "@/components/ui";

export default function RoomScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const view = useRoom(slug);
  if (view === null || view === "missing" || view === "offline") {
    return (
      <Screen back title="ختمة جماعية">
        <Card>
          <T color="mutedForeground" align="center">
            {view === null ? "…" : view === "missing" ? "لم نجد هذه الصفحة؛ ربما حُذفت أو الرابط ناقص." : "تعذّر الاتصال بالموقع. تأكّد من الإنترنت وحاول مرة أخرى."}
          </T>
        </Card>
      </Screen>
    );
  }
  return (
    <Screen back title={view.kind === "memorial" ? "صدقة جارية" : "ختمة جماعية"}>
      <Room key={view.slug} initial={view} />
    </Screen>
  );
}
