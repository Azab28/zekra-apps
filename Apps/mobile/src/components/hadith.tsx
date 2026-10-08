/**
 * A hadith as the site shows it (src/components/site/hadith-card.tsx): its
 * book and number, the main grading (al-Albani's first; Bukhari and Muslim are
 * sahih by the book) in Arabic, the text (without diacritics when chosen),
 * every scholar's grading, and copy/share.
 */
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Share, View } from "react-native";
import { stripTashkeel } from "@lib/content/arabic";
import { GRADE_KIND_LABEL, gradeInArabic, mainGrade, scholarName, SAHIH_BOOKS, type GradeKind } from "@lib/hadith-grades";
import { hadithNumber, type Hadith } from "@/core/sunnah";
import { SITE_URL } from "@/core/site";
import { useStore } from "@/core/store";
import { useTheme } from "@/theme/theme";
import { Check, Copy, Share2 } from "./icons";
import { Card, Row, T } from "./ui";

const KIND_COLOR: Record<GradeKind, string> = { sahih: "#15803d", hasan: "#0e7490", daif: "#b45309", mawdu: "#b91c1c", other: "#6b7280" };

export function GradeBadge({ book, grades }: { book: string; grades: [string, string][] }) {
  const g = mainGrade(book, grades);
  const text = g.grade ? gradeInArabic(g.grade).text : GRADE_KIND_LABEL[g.kind] || "لم يُذكر حكمه";
  const color = KIND_COLOR[g.kind];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: `${color}22` }}>
      <T size={12} weight="semibold" color={color}>
        {text}
      </T>
      {g.by ? (
        <T size={11} color={color} style={{ opacity: 0.75 }}>
          · {scholarName(g.by)}
        </T>
      ) : null}
    </View>
  );
}

export function GradesList({ book, grades }: { book: string; grades: [string, string][] }) {
  const { colors } = useTheme();
  if (SAHIH_BOOKS.includes(book)) {
    return (
      <T size={13} color="mutedForeground">
        أحاديث {book === "bukhari" ? "صحيح البخاري" : "صحيح مسلم"} المسندة صحيحة عند أهل العلم، ولذلك لا يُذكر لها حكم منفرد.
      </T>
    );
  }
  if (!grades.length) return <T size={13} color="mutedForeground">لم يُذكر حكم لهذا الحديث في المصدر.</T>;
  return (
    <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
      {grades.map(([scholar, grade], i) => (
        <Row key={i} style={{ justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
          <T size={13} color="mutedForeground">
            {scholarName(scholar)}
          </T>
          <T size={13} weight="medium">
            {gradeInArabic(grade).text}
          </T>
        </Row>
      ))}
    </View>
  );
}

/** The text, without its diacritics when «بدون تشكيل» is on (the site's reading pref hadithPlain). */
export function HadithText({ text, lines }: { text: string; lines?: number }) {
  const { settings } = useStore();
  return (
    <T size={17} lines={lines} style={{ lineHeight: 34 }} selectable>
      {settings.hadithPlain ? stripTashkeel(text) : text}
    </T>
  );
}

export function HadithCard({ hadith, bookName, showBook, clamp }: { hadith: Hadith; bookName: string; showBook?: boolean; clamp?: boolean }) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const title = `${bookName} — ${hadithNumber(hadith.number)}`;
  const open = () => router.push({ pathname: "/sunnah/[book]/[number]", params: { book: hadith.book, number: hadith.number } });
  return (
    <Card style={{ gap: 10 }}>
      <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <Pressable onPress={open} accessibilityRole="link">
          <T size={14} weight="semibold" color="primary">
            {showBook ? `${bookName} · ` : ""}حديث رقم {hadithNumber(hadith.number)}
          </T>
        </Pressable>
        <GradeBadge book={hadith.book} grades={hadith.grades} />
      </Row>
      <Pressable onPress={clamp ? open : undefined} disabled={!clamp}>
        <HadithText text={hadith.text} lines={clamp ? 6 : undefined} />
      </Pressable>
      <Row gap={16}>
        <Pressable
          onPress={() => {
            void Clipboard.setStringAsync(`${hadith.text}\n— ${title}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          accessibilityRole="button"
        >
          <Row gap={4}>
            {copied ? <Check size={14} color={colors.primary} /> : <Copy size={14} color={colors.mutedForeground} />}
            <T size={13} color={copied ? "primary" : "mutedForeground"}>
              {copied ? "نُسخ" : "نسخ"}
            </T>
          </Row>
        </Pressable>
        <Pressable onPress={() => void Share.share({ message: `${hadith.text}\n— ${title}\n${SITE_URL}/sunnah/${hadith.book}/${hadith.number}` })} accessibilityRole="button">
          <Row gap={4}>
            <Share2 size={14} color={colors.mutedForeground} />
            <T size={13} color="mutedForeground">
              مشاركة
            </T>
          </Row>
        </Pressable>
      </Row>
    </Card>
  );
}
