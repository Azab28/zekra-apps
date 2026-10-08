/**
 * «راسلنا» and «بلّغ عن خطأ», sent to the site's inbox (/api/feedback, as the
 * site's feedback form). Signed in, the session goes with it so the inbox can
 * answer on Telegram (as for a signed-in visitor of the site); otherwise only
 * through the contact the person leaves.
 */
import type { FeedbackContext } from "@lib/types";
import { sitePost, type Reply } from "./site";
import { sessionToken } from "./sync";

export type FeedbackKind = "feedback" | "report";

export const sendFeedback = (kind: FeedbackKind, text: string, contact: string, context?: FeedbackContext): Promise<Reply<object>> =>
  sitePost("/api/feedback", { kind, text: text.trim(), contact: contact.trim() || undefined, context }, sessionToken());
