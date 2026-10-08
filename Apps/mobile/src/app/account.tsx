/**
 * The account: sign in (Telegram, or a username/email and password), a new
 * account (confirmed by the link in its email, on the site), and once signed
 * in what syncs, signing out and deleting the account. Everything goes
 * through the site's app API (src/core/account.ts); the app works fully
 * without an account.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, KeyboardAvoidingView, Linking, Pressable, TextInput, View, type TextInputProps } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import {
  CircleCheck,
  CloudCheck,
  CloudOff,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  Globe,
  KeyRound,
  LogIn,
  LogOut,
  MailCheck,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash,
  UserPlus,
  UserRound,
} from "@/components/icons";
import { Screen } from "@/components/screen";
import { Sheet, useDialogs } from "@/components/sheet";
import { Button, Card, ListRow, Row, SectionTitle, Segmented, T } from "@/components/ui";
import { accountInfo, linkTelegramPoll, linkTelegramStart, OFFLINE, passwordLogin, setPassword, signUp, telegramPoll, telegramStart, userLabel, type Identities, type SignUp } from "@/core/account";
import { oauthLink, oauthLogin, PROVIDER_NAME, type Provider } from "@/core/oauth";
import { SITE_URL } from "@/core/site";
import { deleteAccount, flush, replaceSession, sessionRefused, sessionToken, signIn, signOut, useSync } from "@/core/sync";
import { useTheme } from "@/theme/theme";
import { START } from "@/theme/rtl";

const n = toArabicDigits;
const PRIVACY_URL = `${SITE_URL}/app/privacy`;

export default function Account() {
  const { user } = useSync();
  const { colors } = useTheme();
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <Screen back title="الحساب">
        {user ? <SignedIn /> : <SignedOut />}
        <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} accessibilityRole="link" style={{ alignSelf: "center", paddingVertical: 6 }}>
          <Row gap={6}>
            <ShieldCheck size={14} color={colors.mutedForeground} />
            <T size={13} color="mutedForeground">
              سياسة الخصوصية وشروط الاستخدام
            </T>
          </Row>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}

/* ───────────── signed out ───────────── */

function SignedOut() {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");

  return (
    <>
      <Card style={{ gap: 6 }}>
        <T size={17} weight="bold">
          احفظ ختمتك وتسبيحك في حسابك
        </T>
        <T size={14} color="mutedForeground">
          بحسابك تجد مدينتك وختمتك وعدّاد التسبيح ولونك المفضّل في الموقع وبوت تيليجرام وعلى أجهزتك الأخرى. التطبيق يعمل كاملًا من غير حساب.
        </T>
      </Card>
      <Segmented
        options={[
          { value: "login", label: "تسجيل الدخول", icon: LogIn },
          { value: "signup", label: "حساب جديد", icon: UserPlus },
        ]}
        value={tab}
        onChange={(v) => {
          setTab(v);
          setSentTo(null);
        }}
      />
      {tab === "login" ? (
        <Login identifier={identifier} setIdentifier={setIdentifier} />
      ) : sentTo ? (
        <Card style={{ alignItems: "center", gap: 10, paddingVertical: 22 }}>
          <MailCheckBadge />
          <T size={17} weight="bold" align="center">
            أكّد بريدك
          </T>
          <T color="mutedForeground" align="center">
            أرسلنا رابط التأكيد إلى {sentTo}. افتحه (يفتح على موقع ذِكرى)، ثم ارجع وسجّل الدخول بكلمة المرور.
          </T>
          <Button
            label="تسجيل الدخول"
            icon={LogIn}
            onPress={() => {
              setIdentifier(sentTo);
              setSentTo(null);
              setTab("login");
            }}
          />
        </Card>
      ) : (
        <Register onDone={setSentTo} />
      )}
    </>
  );
}

function MailCheckBadge() {
  const { colors } = useTheme();
  return (
    <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
      <MailCheck size={28} color={colors.primary} />
    </View>
  );
}

function Login({ identifier, setIdentifier }: { identifier: string; setIdentifier: (v: string) => void }) {
  const { colors } = useTheme();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await passwordLogin(identifier.trim(), password);
    // Signed in, this screen turns into the account view.
    const failed = r.ok ? await signIn(r.token, r.user) : r.error;
    if (!failed) return;
    setBusy(false);
    setError(failed);
  };

  return (
    <>
      <TelegramLogin />
      <OAuthButtons />
      <Row gap={10} style={{ marginVertical: 2 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <T size={13} color="mutedForeground">
          أو بكلمة المرور
        </T>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </Row>
      <Card style={{ gap: 12 }}>
        <Field label="اسم المستخدم أو البريد" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" keyboardType="email-address" ltr />
        <PasswordField label="كلمة المرور" value={password} onChangeText={setPassword} onSubmitEditing={() => void submit()} autoComplete="current-password" textContentType="password" />
        {error ? <ErrorText text={error} /> : null}
        <Button label={busy ? "جارٍ الدخول…" : "دخول"} icon={LogIn} disabled={busy || !identifier.trim() || !password} onPress={() => void submit()} />
        <Pressable onPress={() => void Linking.openURL(`${SITE_URL}/forgot-password`)} accessibilityRole="link" style={{ alignSelf: "flex-start" }}>
          <Row gap={4}>
            <T size={13} color="primary">
              نسيت كلمة المرور؟
            </T>
            <ExternalLink size={13} color={colors.primary} />
          </Row>
        </Pressable>
      </Card>
    </>
  );
}

/** «الدخول بجوجل / بفيسبوك»: the site's sign-in in an auth browser, back to the app with a one-time code (core/oauth.ts). */
function OAuthButtons() {
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const go = async (provider: Provider) => {
    setBusy(provider);
    setError(null);
    const r = await oauthLogin(provider);
    if (r?.ok) {
      const failed = await signIn(r.token, r.user);
      if (failed) setError(failed);
    } else if (r) setError(r.error);
    setBusy(null);
  };
  return (
    <View style={{ gap: 8 }}>
      <Row>
        <Button label={busy === "google" ? "…" : "جوجل"} icon={Globe} variant="outline" disabled={!!busy} onPress={() => void go("google")} style={{ flex: 1 }} />
        <Button label={busy === "facebook" ? "…" : "فيسبوك"} icon={Globe} variant="outline" disabled={!!busy} onPress={() => void go("facebook")} style={{ flex: 1 }} />
      </Row>
      {error ? <ErrorText text={error} /> : null}
    </View>
  );
}

/** Telegram: the bot asks «نعم، أنا»; the app waits for the answer (every 2 s, up to 10 minutes). */
function TelegramLogin() {
  const { colors } = useTheme();
  const [wait, setWait] = useState<{ login: string; nonce: string; link: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const until = useRef(0);

  const start = async () => {
    setBusy(true);
    setError(null);
    const r = await telegramStart();
    setBusy(false);
    if (!r.ok) return setError(r.error);
    until.current = Date.now() + 10 * 60_000;
    setWait({ login: r.login, nonce: r.nonce, link: r.link });
    void Linking.openURL(r.link).catch(() => setError("لم نتمكّن من فتح تيليجرام. ثبّته ثم حاول مرة أخرى."));
  };

  useEffect(() => {
    if (!wait) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inflight = false;
    const check = async () => {
      if (!alive || inflight) return;
      clearTimeout(timer);
      if (Date.now() > until.current) {
        setWait(null);
        return setError("انتهت مهلة الطلب. ابدأ من جديد.");
      }
      inflight = true;
      const r = await telegramPoll(wait.login, wait.nonce);
      inflight = false;
      if (!alive) return;
      if (r.ok && r.status === "ok") {
        const failed = await signIn(r.token, r.user);
        if (failed && alive) {
          setWait(null);
          setError(failed);
        }
        return;
      }
      if (r.ok && r.status === "invalid") {
        setWait(null);
        return setError("انتهت صلاحية الطلب أو رُفض. ابدأ من جديد.");
      }
      if (!r.ok && r.status !== 0 && r.status !== 429) {
        setWait(null);
        return setError(r.error);
      }
      timer = setTimeout(() => void check(), !r.ok && r.status === 429 ? (r.retryAfter ?? 10) * 1000 : 2000);
    };
    void check();
    // Back from Telegram: ask at once.
    const sub = AppState.addEventListener("change", (s) => s === "active" && void check());
    return () => {
      alive = false;
      clearTimeout(timer);
      sub.remove();
    };
  }, [wait]);

  if (wait) {
    return (
      <Card style={{ gap: 12, alignItems: "center" }}>
        <ActivityIndicator color={colors.primary} />
        <T weight="semibold" align="center">
          في انتظار موافقتك في تيليجرام
        </T>
        <T size={14} color="mutedForeground" align="center">
          اضغط «ابدأ» في محادثة البوت إن طُلب منك، ثم «نعم، أنا». ارجع بعدها إلى التطبيق.
        </T>
        <Row>
          <Button label="افتح تيليجرام" icon={Send} size="sm" onPress={() => void Linking.openURL(wait.link).catch(() => undefined)} />
          <Button label="إلغاء" size="sm" variant="outline" onPress={() => setWait(null)} />
        </Row>
      </Card>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <Button label={busy ? "جارٍ التحضير…" : "الدخول بتيليجرام"} icon={Send} disabled={busy} onPress={() => void start()} />
      {error ? <ErrorText text={error} /> : null}
    </View>
  );
}

function Register({ onDone }: { onDone: (email: string) => void }) {
  const [f, setF] = useState<SignUp>({ firstName: "", lastName: "", username: "", email: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof SignUp) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await signUp({ ...f, firstName: f.firstName.trim(), lastName: f.lastName.trim(), username: f.username.trim(), email: f.email.trim() });
    setBusy(false);
    if (r.ok) return onDone(r.email);
    setError(r.error);
  };

  return (
    <Card style={{ gap: 12 }}>
      <Row gap={10} align="flex-start">
        <View style={{ flex: 1 }}>
          <Field label="الاسم الأول" value={f.firstName} onChangeText={set("firstName")} autoComplete="given-name" textContentType="givenName" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="اسم العائلة (اختياري)" value={f.lastName} onChangeText={set("lastName")} autoComplete="family-name" textContentType="familyName" />
        </View>
      </Row>
      <Field label="اسم المستخدم" note="حروف إنجليزية وأرقام" value={f.username} onChangeText={set("username")} autoCapitalize="none" autoCorrect={false} autoComplete="username-new" textContentType="username" ltr />
      <Field label="البريد الإلكتروني" value={f.email} onChangeText={set("email")} autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" keyboardType="email-address" ltr />
      <PasswordField label="كلمة المرور" value={f.password} onChangeText={set("password")} autoComplete="new-password" textContentType="newPassword" />
      <PasswordField label="تأكيد كلمة المرور" value={f.confirm} onChangeText={set("confirm")} onSubmitEditing={() => void submit()} autoComplete="new-password" textContentType="newPassword" />
      {error ? <ErrorText text={error} /> : null}
      <Button label={busy ? "جارٍ الإنشاء…" : "إنشاء الحساب"} icon={UserPlus} disabled={busy || !f.firstName.trim() || !f.email.trim() || !f.password} onPress={() => void submit()} />
      <T size={12} color="mutedForeground">
        نرسل رابط تأكيد إلى بريدك، وتعمل كلمة المرور بعد تأكيده.
      </T>
    </Card>
  );
}

/* ───────────── signed in ───────────── */

function SignedIn() {
  const { user, pending, offline, prefs } = useSync();
  const { colors } = useTheme();
  const dialogs = useDialogs();
  const [syncing, setSyncing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  if (!user) return null;
  const streak = prefs.streak?.days ?? 0;

  const syncNow = async () => {
    setSyncing(true);
    await flush(true);
    setSyncing(false);
  };

  const logout = async () => {
    const ok = await dialogs.confirm({
      title: "تسجيل الخروج؟",
      message:
        "تبقى مدينتك على هذا الجهاز، أما الختمة والتسبيح فمحفوظة في حسابك وتعود حين تسجّل الدخول." +
        (pending > 0 ? " بعض تغييراتك لم تصل إلى الموقع بعد، وإن لم تصل الآن فستضيع." : ""),
      confirm: "خروج",
    });
    if (!ok) return;
    setLeaving(true);
    await signOut();
  };

  return (
    <>
      <Card style={{ gap: 12 }}>
        <Row gap={12}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
            <UserRound size={26} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <T size={18} weight="bold" lines={1}>
              {userLabel(user)}
            </T>
            <T size={13} color="mutedForeground" lines={1}>
              {user.telegram ? "حساب تيليجرام" : user.username ? `@${user.username}` : "حساب على موقع ذِكرى"}
            </T>
          </View>
          {streak > 0 ? (
            <Row gap={4} style={{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Flame size={14} color={colors.gold} />
              <T size={12} weight="semibold">
                {n(streak)}
              </T>
            </Row>
          ) : null}
        </Row>
        <Row gap={8} style={{ backgroundColor: colors.muted, borderRadius: 12, padding: 12 }}>
          {offline ? <CloudOff size={18} color={colors.mutedForeground} /> : <CloudCheck size={18} color={colors.primary} />}
          <T size={14} style={{ flex: 1 }}>
            {pending > 0
              ? offline
                ? `${n(pending)} ${pending === 1 ? "تغيير ينتظر" : "تغييرات تنتظر"} الاتصال بالإنترنت`
                : `${n(pending)} ${pending === 1 ? "تغيير" : "تغييرات"} قيد الإرسال`
              : offline
                ? OFFLINE
                : "كل شيء محفوظ في حسابك"}
          </T>
          {syncing ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </Row>
        <Button label="مزامنة الآن" icon={RefreshCw} variant="outline" size="sm" disabled={syncing} onPress={() => void syncNow()} />
      </Card>

      <Card style={{ gap: 6 }}>
        <T weight="semibold">ما يُحفظ في حسابك</T>
        <T size={14} color="mutedForeground">
          مدينتك وتعديل المواقيت، وعدّاد التسبيح، وختمتك، ولون التطبيق، والقارئ في المصحف، وأيام وردك المتتالية. تجدها نفسها في الموقع والبوت. تنبيهات الأذان والتنزيلات تبقى على هذا الجهاز.
        </T>
      </Card>

      <Methods />

      <Card padded={false} style={{ overflow: "hidden" }}>
        <ListRow icon={LogOut} title={leaving ? "جارٍ تسجيل الخروج…" : "تسجيل الخروج"} onPress={leaving ? undefined : () => void logout()} />
        <ListRow icon={Trash} title="حذف الحساب" note="يُحذف حسابك وكل ما فيه نهائيًا" onPress={() => setDeleting(true)} last />
      </Card>
      <DeleteSheet open={deleting} onClose={() => setDeleting(false)} />
    </>
  );
}

/** «طرق الدخول»: Telegram, Google, Facebook and a password on this account, and adding the missing ones (SERVER-SPEC.md). */
function Methods() {
  const { colors } = useTheme();
  // null while loading; "missing" when the site doesn't have the API; a string otherwise is why it failed.
  const [info, setInfo] = useState<Identities | null | "missing" | { failed: string }>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [password, setPasswordOpen] = useState(false);
  const [telegram, setTelegram] = useState<{ login: string; nonce: string; link: string } | null>(null);

  const load = async () => {
    const t = sessionToken();
    if (!t) return;
    const r = await accountInfo(t);
    if (r.ok) return setInfo(r);
    sessionRefused(r.status);
    setInfo(r.status === 404 ? "missing" : { failed: r.error });
  };
  useEffect(() => {
    void load();
  }, []);

  // Linking Telegram: wait for «نعم، أنا» in the bot, then the account is the Telegram one (a new session).
  useEffect(() => {
    if (!telegram) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const until = Date.now() + 10 * 60_000;
    const check = async () => {
      const t = sessionToken();
      if (!alive || !t) return;
      if (Date.now() > until) return setTelegram(null);
      const r = await linkTelegramPoll(t, telegram.login, telegram.nonce);
      if (!alive) return;
      if (r.ok && r.status === "ok") {
        await replaceSession(r.token, r.user);
        setTelegram(null);
        setNote({ text: "رُبط حسابك بتيليجرام." });
        return void load();
      }
      if ((r.ok && r.status === "invalid") || (!r.ok && r.status !== 0 && r.status !== 429)) {
        if (!r.ok) sessionRefused(r.status);
        setTelegram(null);
        return setNote({ text: r.ok ? "انتهت صلاحية الطلب، ابدأ من جديد." : r.error, bad: true });
      }
      timer = setTimeout(() => void check(), 2000);
    };
    void check();
    const sub = AppState.addEventListener("change", (s) => s === "active" && void check());
    return () => {
      alive = false;
      clearTimeout(timer);
      sub.remove();
    };
  }, [telegram]);

  if (info === null) return null;
  if (info !== "missing" && "failed" in info) {
    return (
      <Card style={{ gap: 8, alignItems: "center" }}>
        <T size={13} color="mutedForeground" align="center">
          {info.failed}
        </T>
        <Button label="إعادة المحاولة" size="sm" variant="outline" onPress={() => { setInfo(null); void load(); }} />
      </Card>
    );
  }
  if (info === "missing") {
    return (
      <Card>
        <T size={13} color="mutedForeground">
          إدارة طرق الدخول (ربط جوجل وفيسبوك وتيليجرام وكلمة المرور) تحتاج تحديثًا في الموقع، وستظهر هنا بعده.
        </T>
      </Card>
    );
  }

  const link = async (provider: Provider) => {
    const t = sessionToken();
    if (!t) return;
    setBusy(provider);
    setNote(null);
    const r = await oauthLink(provider, t);
    setBusy(null);
    if (r?.ok) {
      setNote({ text: `رُبط ${PROVIDER_NAME[provider]} بحسابك.` });
      void load();
    } else if (r) {
      if (!r.ok) sessionRefused(r.status);
      setNote({ text: r.error, bad: true });
    }
  };
  const startTelegram = async () => {
    const t = sessionToken();
    if (!t) return;
    setBusy("telegram");
    const r = await linkTelegramStart(t);
    setBusy(null);
    if (!r.ok) {
      sessionRefused(r.status);
      return setNote({ text: r.error, bad: true });
    }
    setTelegram({ login: r.login, nonce: r.nonce, link: r.link });
    void Linking.openURL(r.link).catch(() => undefined);
  };

  const row = (title: string, on: boolean, action?: () => void, note?: string) => (
    <ListRow
      key={title}
      title={title}
      note={on ? (note ?? "مربوط") : "غير مربوط"}
      onPress={on ? undefined : action}
      trailing={on ? <CircleCheck size={18} color={colors.primary} /> : busy && title.includes(busy) ? <ActivityIndicator color={colors.primary} /> : <T size={13} color="primary">ربط</T>}
    />
  );
  return (
    <>
      <SectionTitle>طرق الدخول</SectionTitle>
      <Card padded={false} style={{ overflow: "hidden" }}>
        {row("تيليجرام", info.telegram, () => void startTelegram())}
        {row("جوجل", info.google, () => void link("google"))}
        {row("فيسبوك", info.facebook, () => void link("facebook"))}
        <ListRow
          title="كلمة المرور"
          note={info.hasPassword ? `${info.username ? `@${info.username}` : ""}${info.email ? ` · ${info.email}` : ""}` : "أضف اسم مستخدم وبريدًا وكلمة مرور"}
          onPress={() => setPasswordOpen((v) => !v)}
          trailing={<KeyRound size={18} color={colors.mutedForeground} />}
          last
        />
      </Card>
      {telegram ? (
        <Card style={{ gap: 8, alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
          <T size={14} align="center">
            اضغط «نعم، أنا» في محادثة البوت، ثم ارجع إلى التطبيق. تنتقل بياناتك إلى حساب تيليجرام.
          </T>
          <Button label="إلغاء" size="sm" variant="outline" onPress={() => setTelegram(null)} />
        </Card>
      ) : null}
      {password ? <PasswordForm first={!info.hasPassword} onDone={(text) => { setPasswordOpen(false); setNote({ text }); void load(); }} /> : null}
      {note ? <T size={13} color={note.bad ? "destructive" : "primary"}>{note.text}</T> : null}
    </>
  );
}

/** Changing the password (with the current one), or a first one with a username and an email to confirm. */
function PasswordForm({ first, onDone }: { first: boolean; onDone: (note: string) => void }) {
  const [f, setF] = useState({ current: "", password: "", confirm: "", username: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const submit = async () => {
    const t = sessionToken();
    if (!t) return;
    setBusy(true);
    setError(null);
    const r = await setPassword(t, first ? { password: f.password, confirm: f.confirm, username: f.username.trim(), email: f.email.trim() } : { current: f.current, password: f.password, confirm: f.confirm });
    setBusy(false);
    if (!r.ok) {
      sessionRefused(r.status);
      return setError(r.error);
    }
    onDone(r.pending ? `أرسلنا رابط التأكيد إلى ${r.email ?? "بريدك"}؛ تعمل كلمة المرور بعد تأكيده.` : "تغيّرت كلمة المرور.");
  };
  return (
    <Card style={{ gap: 12 }}>
      {first ? (
        <>
          <Field label="اسم المستخدم" note="حروف إنجليزية وأرقام" value={f.username} onChangeText={set("username")} autoCapitalize="none" autoCorrect={false} ltr />
          <Field label="البريد الإلكتروني" value={f.email} onChangeText={set("email")} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" ltr />
        </>
      ) : (
        <PasswordField label="كلمة المرور الحالية" value={f.current} onChangeText={set("current")} autoComplete="current-password" textContentType="password" />
      )}
      <PasswordField label="كلمة المرور الجديدة" value={f.password} onChangeText={set("password")} autoComplete="new-password" textContentType="newPassword" />
      <PasswordField label="تأكيد كلمة المرور" value={f.confirm} onChangeText={set("confirm")} autoComplete="new-password" textContentType="newPassword" />
      {error ? <ErrorText text={error} /> : null}
      <Button label={busy ? "جارٍ الحفظ…" : "حفظ"} icon={KeyRound} disabled={busy || !f.password} onPress={() => void submit()} />
    </Card>
  );
}

function DeleteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setText("");
    setError(null);
    onClose();
  };
  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await deleteAccount(text.trim());
    setBusy(false);
    if (r.ok) return close();
    setError(r.error);
  };

  return (
    <Sheet open={open} onClose={close} title="حذف الحساب">
      <View style={{ gap: 12 }}>
        <T color="mutedForeground">
          يُحذف حسابك نهائيًا مع ختمتك وتسبيحك وإعداداتك في الموقع والبوت، ولا يمكن التراجع. تبقى مدينتك على هذا الجهاز ليستمر حساب المواقيت.
        </T>
        <Field label="اكتب «حذف» للتأكيد" value={text} onChangeText={setText} autoCorrect={false} />
        {error ? <ErrorText text={error} /> : null}
        <Button label={busy ? "جارٍ الحذف…" : "احذف حسابي"} variant="danger" icon={Trash} disabled={busy || text.trim() !== "حذف"} onPress={() => void submit()} />
      </View>
    </Sheet>
  );
}

/* ───────────── fields ───────────── */

type FieldProps = TextInputProps & { label: string; note?: string; ltr?: boolean; trailing?: ReactNode };

function Field({ label, note, ltr, trailing, style, ...rest }: FieldProps) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T size={13} weight="medium">
        {label}
        {note ? <T size={12} color="mutedForeground">{`  ${note}`}</T> : null}
      </T>
      <Row gap={0} style={{ backgroundColor: colors.muted, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
        <TextInput
          placeholderTextColor={colors.mutedForeground}
          {...rest}
          style={[
            {
              flex: 1,
              height: 46,
              paddingHorizontal: 12,
              color: colors.foreground,
              fontFamily: "Plex-Regular",
              fontSize: 15,
              // Emails and usernames are typed left to right; the rest as Arabic.
              textAlign: ltr ? "left" : START,
              writingDirection: ltr ? "ltr" : "rtl",
            },
            style,
          ]}
        />
        {trailing}
      </Row>
    </View>
  );
}

function PasswordField(props: Omit<FieldProps, "secureTextEntry" | "trailing" | "ltr">) {
  const { colors } = useTheme();
  const [shown, setShown] = useState(false);
  return (
    <Field
      {...props}
      ltr
      secureTextEntry={!shown}
      autoCapitalize="none"
      autoCorrect={false}
      trailing={
        <Pressable onPress={() => setShown((s) => !s)} accessibilityRole="button" accessibilityLabel={shown ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} hitSlop={8} style={{ paddingHorizontal: 12 }}>
          {shown ? <EyeOff size={18} color={colors.mutedForeground} /> : <Eye size={18} color={colors.mutedForeground} />}
        </Pressable>
      }
    />
  );
}

function ErrorText({ text }: { text: string }) {
  return (
    <T size={13} color="destructive">
      {text}
    </T>
  );
}
