/**
 * Our own windows instead of the system's alert/confirm: a centred dialog and
 * a bottom sheet, both in the app's look. A Modal is its own native window, so
 * each sets the right-to-left direction again.
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { X } from "./icons";
import { Button, IconButton, RADIUS, T } from "./ui";

/** A sheet from the bottom with a title and a close button; the body scrolls unless `fixed`. */
export function Sheet({ open, onClose, title, children, fixed }: { open: boolean; onClose: () => void; title: string; children: ReactNode; fixed?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, direction: "rtl", justifyContent: "flex-end" }}>
        <Pressable style={{ position: "absolute", top: 0, bottom: 0, start: 0, end: 0, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={onClose} accessibilityLabel="إغلاق" />
        <View
          style={{
            maxHeight: "88%",
            backgroundColor: colors.card,
            borderTopLeftRadius: RADIUS + 4,
            borderTopRightRadius: RADIUS + 4,
            borderWidth: 1,
            borderColor: colors.border,
            paddingBottom: insets.bottom + 12,
          }}
        >
          <View style={{ alignItems: "center", paddingTop: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
            <T size={17} weight="bold" style={{ flex: 1 }}>
              {title}
            </T>
            <IconButton icon={X} label="إغلاق" onPress={onClose} size={36} />
          </View>
          {fixed ? children : <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type DialogButton = { label: string; value: string; variant?: "primary" | "outline" | "danger" };
type DialogRequest = { title: string; message?: string; buttons: DialogButton[]; resolve: (v: string | null) => void };

type Dialogs = {
  /** A question with a confirm and a cancel button; true when confirmed. */
  confirm: (o: { title: string; message?: string; confirm?: string; cancel?: string; danger?: boolean }) => Promise<boolean>;
  /** A notice with one button. */
  notice: (o: { title: string; message?: string; ok?: string }) => Promise<void>;
};

const DialogContext = createContext<Dialogs | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<DialogRequest | null>(null);
  const queue = useRef<DialogRequest[]>([]);

  const show = useCallback((r: Omit<DialogRequest, "resolve">) => {
    return new Promise<string | null>((resolve) => {
      const full = { ...r, resolve };
      setReq((cur) => {
        if (cur) {
          queue.current.push(full);
          return cur;
        }
        return full;
      });
    });
  }, []);

  const close = (value: string | null) => {
    req?.resolve(value);
    setReq(queue.current.shift() ?? null);
  };

  const api = useRef<Dialogs>({
    confirm: async ({ title, message, confirm = "تأكيد", cancel = "إلغاء", danger }) =>
      (await show({ title, message, buttons: [{ label: confirm, value: "ok", variant: danger ? "danger" : "primary" }, { label: cancel, value: "cancel", variant: "outline" }] })) === "ok",
    notice: async ({ title, message, ok = "حسنًا" }) => {
      await show({ title, message, buttons: [{ label: ok, value: "ok" }] });
    },
  }).current;

  return (
    <DialogContext.Provider value={api}>
      {children}
      <DialogView req={req} onClose={close} />
    </DialogContext.Provider>
  );
}

function DialogView({ req, onClose }: { req: DialogRequest | null; onClose: (v: string | null) => void }) {
  const { colors } = useTheme();
  return (
    <Modal visible={!!req} transparent animationType="fade" onRequestClose={() => onClose(null)} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, direction: "rtl", alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.45)" }}>
        {req && (
          <View style={{ width: "100%", maxWidth: 380, backgroundColor: colors.card, borderRadius: RADIUS + 4, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 10 }}>
            <T size={17} weight="bold">
              {req.title}
            </T>
            {req.message ? <T color="mutedForeground">{req.message}</T> : null}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              {req.buttons.map((b) => (
                <Button key={b.value} label={b.label} variant={b.variant ?? "primary"} onPress={() => onClose(b.value)} style={{ flex: 1 }} />
              ))}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

export function useDialogs(): Dialogs {
  const d = useContext(DialogContext);
  if (!d) throw new Error("useDialogs outside DialogProvider");
  return d;
}
