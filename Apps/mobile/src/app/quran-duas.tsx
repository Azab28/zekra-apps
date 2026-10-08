/**
 * The Quran's duas, as the site's /quran-duas: the references in
 * src/lib/content/quran-duas.ts, each dua's whole ayah (or ayat) from
 * data/quran.json, with its surah and number; copy, share, an image of a
 * single ayah, and its place in the surah.
 */
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { Share, View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { quran } from "@lib/content/data";
import { OTHER_DUAS, RABBANA_DUAS } from "@lib/content/quran-duas";
import type { Selection } from "@lib/content/selected-ayat";
import { Check, Copy, FileText, Image as ImageIcon, Share2 } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Card, IconButton, Row, SectionTitle, T } from "@/components/ui";
import { shareImage } from "@/core/images";
import { surahName } from "@/core/quran";
import { SITE_URL } from "@/core/site";
import { useStore } from "@/core/store";
import { QURAN_FONT } from "@/theme/fonts";

const n = toArabicDigits;

export default function QuranDuas() {
  return (
    <Screen back title="أدعية من القرآن">
      <T color="mutedForeground">أدعية وردت في القرآن الكريم، كل دعاء بنص الآية كاملة كما في المصحف، مع السورة ورقم الآية.</T>
      <SectionTitle>ربَّنا</SectionTitle>
      {RABBANA_DUAS.map((e) => (
        <Dua key={e.join(":")} entry={e} />
      ))}
      <SectionTitle>ربِّ، ومن أدعية الأنبياء</SectionTitle>
      {OTHER_DUAS.map((e) => (
        <Dua key={e.join(":")} entry={e} />
      ))}
    </Screen>
  );
}

function Dua({ entry: [surah, from, to] }: { entry: Selection }) {
  const { settings } = useStore();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = quran();
  const start = q.surahs[surah - 1].start;
  const ayat = q.ayahs.slice(start + from - 1, start + to);
  const name = surahName(surah);
  const range = from === to ? n(from) : `${n(from)}–${n(to)}`;
  const reference = `[${name}: ${range}]`;
  const text = ayat.map((a) => `${a[4]} ﴿${n(a[1])}﴾`).join(" ");
  const plain = `﴿ ${ayat.map((a) => a[4]).join(" ")} ﴾ ${reference}`;

  return (
    <Card style={{ gap: 10 }}>
      <T size={22} style={{ fontFamily: QURAN_FONT, lineHeight: 48 }} selectable>
        {text}
      </T>
      <Row style={{ justifyContent: "space-between" }}>
        <T size={13} color="mutedForeground" style={{ flex: 1 }}>
          سورة {name}، {from === to ? "الآية" : "الآيات"} {range}
        </T>
        <Row gap={2}>
          <IconButton
            icon={copied ? Check : Copy}
            label="نسخ"
            size={34}
            tone="plain"
            onPress={() => {
              void Clipboard.setStringAsync(plain);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          />
          <IconButton icon={Share2} label="مشاركة" size={34} tone="plain" onPress={() => void Share.share({ message: `${plain}\n${SITE_URL}/surah/${surah}#${from}` })} />
          {from === to ? (
            <IconButton
              icon={ImageIcon}
              label="صورة"
              size={34}
              tone="plain"
              onPress={() => void shareImage({ ayah: start + from - 1 }, "image", settings.imageStyle, `دعاء من سورة ${name}`).then(setError)}
            />
          ) : null}
          <IconButton icon={FileText} label="في السورة" size={34} tone="plain" onPress={() => router.push({ pathname: "/surah/[n]", params: { n: String(surah), ayah: String(from) } })} />
        </Row>
      </Row>
      {error ? (
        <View>
          <T size={13} color="destructive">
            {error}
          </T>
        </View>
      ) : null}
    </Card>
  );
}
