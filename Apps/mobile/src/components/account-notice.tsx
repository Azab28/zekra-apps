/** The site signed the account out (its session ended, or the account was stopped): said once, with a way back in. */
import { router } from "expo-router";
import { useEffect } from "react";
import { clearEnded, useSync } from "@/core/sync";
import { useDialogs } from "./sheet";

export function AccountNotice() {
  const { ended } = useSync();
  const dialogs = useDialogs();
  useEffect(() => {
    if (!ended) return;
    clearEnded();
    void dialogs
      .confirm({ title: ended, message: "بياناتك محفوظة في حسابك، وتبقى مدينتك على هذا الجهاز.", confirm: "تسجيل الدخول", cancel: "لاحقًا" })
      .then((ok) => ok && router.push("/account"));
  }, [ended, dialogs]);
  return null;
}
