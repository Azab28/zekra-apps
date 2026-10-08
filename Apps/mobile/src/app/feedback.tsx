/** «راسلنا», as the site's /feedback: a suggestion, a complaint or a note to the site's inbox (components/feedback-form.tsx). */
import { FeedbackForm } from "@/components/feedback-form";
import { Screen } from "@/components/screen";
import { Card, T } from "@/components/ui";

export default function Feedback() {
  return (
    <Screen back title="راسلنا">
      <T color="mutedForeground">اقتراح، أو شكوى، أو خطأ لاحظته: نقرأ كل رسالة. اترك وسيلة للتواصل إن أردت ردًا.</T>
      <Card>
        <FeedbackForm />
      </Card>
    </Screen>
  );
}
