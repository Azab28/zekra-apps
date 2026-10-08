/** Every section, and the settings. */
import { router } from "expo-router";
import { MEMORIAL } from "@lib/memorial";
import { HandHeart, MessageCircle, Settings, UserRound } from "@/components/icons";
import { Screen } from "@/components/screen";
import { SectionGrid } from "@/components/section-grid";
import { Card, ListRow } from "@/components/ui";
import { userLabel } from "@/core/account";
import { SECTIONS } from "@/core/sections";
import { useStore } from "@/core/store";

export default function More() {
  const { user } = useStore();
  return (
    <Screen tab title="المزيد">
      <SectionGrid sections={SECTIONS.filter((s) => !["prayer", "quran", "azkar"].includes(s.id))} />
      <Card padded={false} style={{ overflow: "hidden" }}>
        <ListRow
          icon={UserRound}
          title={user ? userLabel(user) : "الحساب"}
          note={user ? "حسابك ومزامنة بياناتك" : "سجّل الدخول لتجد ختمتك وتسبيحك في الموقع والبوت"}
          onPress={() => router.push("/account")}
        />
        <ListRow icon={HandHeart} title="صدقة جارية" note={`عن ${MEMORIAL.name} رحمه الله`} onPress={() => router.push("/ali")} />
        <ListRow icon={MessageCircle} title="راسلنا" note="اقتراح، أو شكوى، أو خطأ لاحظته" onPress={() => router.push("/feedback")} />
        <ListRow icon={Settings} title="الإعدادات" note="المظهر واللون وشكل الشريط" onPress={() => router.push("/settings")} last />
      </Card>
    </Screen>
  );
}
