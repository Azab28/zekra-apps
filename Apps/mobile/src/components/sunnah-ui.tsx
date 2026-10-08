/** Shared bits of the «السنة» screens: the books (read once), loading and failure states, a pager and the sort. */
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { sunnahHome, SORTS, type Book, type Failure, type Hadith, type Sort } from "@/core/sunnah";
import { useTheme } from "@/theme/theme";
import { ChevronLeft, ChevronRight } from "./icons";
import { Card, IconButton, Row, T } from "./ui";

let cache: { books: Book[]; today: Hadith | null } | null = null;

/** The books and the hadith of the day (kept once read), or why they didn't come. */
export function useSunnahHome() {
  const [state, setState] = useState<typeof cache | Failure>(cache);
  useEffect(() => {
    if (cache) return;
    void sunnahHome().then((r) => {
      if (typeof r !== "string") cache = r;
      setState(r);
    });
  }, []);
  return state;
}

export const bookName = (books: Book[] | undefined, id: string) => books?.find((b) => b.id === id)?.short ?? id;

export function Loading() {
  const { colors } = useTheme();
  return <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />;
}

const WHY: Record<Failure, string> = {
  offline: "تعذّر الاتصال بالموقع. تأكّد من الإنترنت وحاول مرة أخرى.",
  missing: "لم نجد هذا في كتب السنة.",
  limited: "طلبات كثيرة في وقت قصير؛ انتظر دقيقة ثم حاول مرة أخرى.",
  down: "قسم السنة غير متاح الآن، حاول بعد قليل.",
};

/** Why a page of the section didn't come. */
export function Unavailable({ why }: { why: Failure }) {
  return (
    <Card>
      <T color="mutedForeground" align="center">
        {WHY[why]}
      </T>
    </Card>
  );
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <Row style={{ justifyContent: "center" }} gap={16}>
      <IconButton icon={ChevronRight} label="السابق" disabled={page <= 1} onPress={() => onPage(page - 1)} />
      <T size={13} color="mutedForeground">
        صفحة {toArabicDigits(page)} من {toArabicDigits(pages)}
      </T>
      <IconButton icon={ChevronLeft} label="التالي" disabled={page >= pages} onPress={() => onPage(page + 1)} />
    </Row>
  );
}

export function SortBar({ value, onChange }: { value: Sort; onChange: (s: Sort) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {(Object.keys(SORTS) as Sort[]).map((s) => {
        const on = s === value;
        return (
          <Pressable
            key={s}
            onPress={() => onChange(s)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ borderRadius: 999, borderWidth: 1, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card, paddingHorizontal: 12, paddingVertical: 4 }}
          >
            <T size={12} color={on ? "primaryForeground" : "foreground"}>
              {SORTS[s]}
            </T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
