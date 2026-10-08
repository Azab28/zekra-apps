/** The five tabs under the floating bar (the site's main sections; the rest are under «المزيد»). */
import { Tabs } from "expo-router";
import { FloatingBar, type TabMeta } from "@/components/floating-bar";
import { BookOpen, Clock, HandHeart, House, LayoutGrid } from "@/components/icons";

const TABS: Record<string, TabMeta> = {
  index: { title: "الرئيسية", icon: House },
  quran: { title: "المصحف", icon: BookOpen },
  azkar: { title: "الأذكار", icon: HandHeart },
  prayer: { title: "المواقيت", icon: Clock },
  more: { title: "المزيد", icon: LayoutGrid },
};

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, animation: "fade" }} tabBar={(props) => <FloatingBar {...props} tabs={TABS} />}>
      {Object.entries(TABS).map(([name, t]) => (
        <Tabs.Screen key={name} name={name} options={{ title: t.title }} />
      ))}
    </Tabs>
  );
}
