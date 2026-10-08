/** The message form: «راسلنا» (feedback) or a report about `context` (an ayah, a zikr, a tafsir), as the site's FeedbackForm. */
import { useState } from "react";
import { TextInput, View, type TextStyle } from "react-native";
import type { FeedbackContext } from "@lib/types";
import { CircleCheck, Send } from "./icons";
import { Button, Row, T } from "./ui";
import { sendFeedback } from "@/core/feedback";
import { useTheme } from "@/theme/theme";
import { START } from "@/theme/rtl";

export function FeedbackForm({ context, onDone }: { context?: FeedbackContext; onDone?: () => void }) {
  const { colors } = useTheme();
  const [text, setText] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const input: TextStyle = { color: colors.foreground, fontFamily: "Plex-Regular", fontSize: 15, textAlign: START, writingDirection: "rtl" };
  const box = { backgroundColor: colors.muted, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 };

  if (sent) {
    return (
      <View style={{ gap: 10, alignItems: "center", paddingVertical: 8 }}>
        <CircleCheck size={32} color={colors.primary} />
        <T weight="semibold" align="center">
          وصلتنا رسالتك، جزاك الله خيرًا
        </T>
        <T size={14} color="mutedForeground" align="center">
          {context ? "سنراجع الموضع ونصححه إن شاء الله." : "سنقرؤها ونرد إن تركت وسيلة للتواصل."}
        </T>
        {onDone ? <Button label="حسنًا" size="sm" variant="outline" onPress={onDone} /> : null}
      </View>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await sendFeedback(context ? "report" : "feedback", text, contact, context);
    setBusy(false);
    if (r.ok) setSent(true);
    else setError(r.error);
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={box}>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
          placeholder={context ? "ما الخطأ؟ في النص، أو التشكيل، أو العرض…" : "اقتراح، أو شكوى، أو أي ملاحظة…"}
          placeholderTextColor={colors.mutedForeground}
          style={[input, { minHeight: 96, paddingVertical: 10, textAlignVertical: "top" }]}
        />
      </View>
      <View style={box}>
        <TextInput
          value={contact}
          onChangeText={setContact}
          maxLength={120}
          autoCapitalize="none"
          placeholder="وسيلة للتواصل إن أردت ردًا (اختياري)"
          placeholderTextColor={colors.mutedForeground}
          style={[input, { height: 44 }]}
        />
      </View>
      {error ? (
        <T size={13} color="destructive">
          {error}
        </T>
      ) : null}
      <Row>
        <Button label={busy ? "جارٍ الإرسال…" : "إرسال"} icon={Send} size="sm" disabled={busy || text.trim().length < 3} onPress={() => void submit()} />
      </Row>
    </View>
  );
}
