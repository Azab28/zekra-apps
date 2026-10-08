/**
 * علي متولي عزب: the project is a «صدقة جارية» for him, as the site's /ali —
 * his name and day, the dua for the deceased (Hisn al-Muslim, the same item as
 * the site's memorialDua), his permanent khatma and counters (the room
 * MEMORIAL.khatmaSlug, components/room.tsx) with his dua poster in its twenty
 * looks between them. His photos are only on the site (a link).
 */
import * as WebBrowser from "expo-web-browser";
import { DateTime } from "luxon";
import { Share, View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { chapterById } from "@lib/content/data";
import { hijriLabel } from "@lib/hijri-core";
import { DEFAULT_POSTER_FONT } from "@lib/poster-fonts";
import { MEMORIAL, MEMORIAL_MOTTO } from "@lib/memorial";
import { HandHeart, Image as PhotosIcon, Share2 } from "@/components/icons";
import { Posters } from "@/components/posters";
import { Room, useRoom } from "@/components/room";
import { Screen } from "@/components/screen";
import { Button, Card, Row, SectionTitle, T } from "@/components/ui";
import { SITE_URL } from "@/core/site";
import { useStore } from "@/core/store";
import { QURAN_FONT } from "@/theme/fonts";
import { useTheme } from "@/theme/theme";

/** Hisn al-Muslim's dua for the deceased (src/lib/memorial-server.ts DUA). */
const DUA = { chapter: 55, item: 156 };

function memorialDua(): { text: string; source: string } | null {
  const c = chapterById(DUA.chapter);
  const z = c?.items.find((i) => i.id === DUA.item);
  if (!c || !z) return null;
  return { text: z.text.replace(/\(\(|\)\)|\[|\]/g, "").replace(/\s+/g, " ").trim(), source: `حصن المسلم: ${c.title}` };
}

export default function Ali() {
  const { colors } = useTheme();
  const { hijriOffset } = useStore();
  const room = useRoom(MEMORIAL.khatmaSlug);
  const died = DateTime.fromISO(MEMORIAL.died, { zone: "UTC" });
  const gregorian = new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(died.toJSDate());
  const dua = memorialDua();
  const url = `${SITE_URL}${MEMORIAL.path}`;

  const posters = (
    <View style={{ gap: 8 }}>
      <SectionTitle>بوستر الدعاء له</SectionTitle>
      <T size={13} color="mutedForeground">
        اختر شكلًا من عشرين، واحفظه أو أرسله لمن يدعو له.
      </T>
      <Posters url={(style, font) => `${SITE_URL}/api/memorial-poster?style=${style}${font === DEFAULT_POSTER_FONT ? "" : `&font=${font}`}`} file="memorial-poster" title={`دعاء لـ${MEMORIAL.name}`} />
    </View>
  );

  return (
    <Screen back title="صدقة جارية">
      <Card style={{ alignItems: "center", gap: 8, paddingVertical: 24 }}>
        <T size={13} weight="medium" color="primary">
          صدقة جارية
        </T>
        <T size={28} weight="bold" align="center">
          {MEMORIAL.name}
        </T>
        <T size={17} color="primary">
          رحمه الله وغفر له
        </T>
        <T size={20} align="center" style={{ fontFamily: QURAN_FONT, lineHeight: 40, opacity: 0.85 }}>
          {MEMORIAL_MOTTO}
        </T>
        <T size={13} color="mutedForeground" align="center">
          توفي يوم {gregorian} م، الموافق {hijriLabel(died, hijriOffset)}
        </T>
        <T size={14} color="mutedForeground" align="center">
          «ذِكرى» وكل ما فيه صدقة جارية عنه. نسأل الله أن يجعل كل آية تُقرأ هنا، وكل ذكر يُقال، وكل تلاوة تُسمع، في ميزان حسناته.
        </T>
        <Row style={{ flexWrap: "wrap", justifyContent: "center" }}>
          <Button label="شارك الصفحة" icon={Share2} size="sm" onPress={() => void Share.share({ message: `صدقة جارية عن ${MEMORIAL.name} رحمه الله: اقرأ له جزءًا، وسبّح، وادعُ له\n${url}` })} />
          <Button label="صوره على الموقع" icon={PhotosIcon} size="sm" variant="outline" onPress={() => void WebBrowser.openBrowserAsync(url, { toolbarColor: colors.card, controlsColor: colors.primary })} />
        </Row>
      </Card>

      {dua ? (
        <Card style={{ gap: 8, backgroundColor: colors.accent }}>
          <Row gap={6}>
            <HandHeart size={18} color={colors.primary} />
            <T weight="bold">ادعُ له</T>
          </Row>
          <T size={20} style={{ fontFamily: QURAN_FONT, lineHeight: 44 }} selectable>
            {dua.text}
          </T>
          <T size={12} color="mutedForeground">
            {dua.source}
          </T>
        </Card>
      ) : null}

      <SectionTitle>اقرأ له، وسبّح</SectionTitle>
      {room && typeof room === "object" ? (
        <>
          <T size={13} color="mutedForeground">
            احجز جزءًا من القرآن واقرأه له، أو زد العدّادات بتسبيحة أو استغفار أو صلاة على النبي ﷺ. كلما تمت ختمة بدأت بعدها ختمة جديدة.
            {room.round > 1 ? ` خُتم له القرآن حتى الآن ${toArabicDigits(room.round - 1)} مرة.` : ""}
          </T>
          <Room initial={room} beforeParts={posters} />
        </>
      ) : (
        <>
          <Card>
            <T size={13} color="mutedForeground" align="center">
              {room === null ? "…" : "تعذّر تحميل الختمة الآن. تأكّد من الإنترنت وحاول مرة أخرى."}
            </T>
          </Card>
          {posters}
        </>
      )}
    </Screen>
  );
}
