# What the phone app needs from the server

> **بالعربي باختصار:** الأبلكيشن فيه دلوقتي شاشات «السنة»، والدخول بجوجل وفيسبوك، وإدارة طرق الدخول (ربط تيليجرام/جوجل/فيسبوك، كلمة مرور)، وروابط الموقع اللي تفتح في الأبلكيشن. كلها مستنية الـ APIs اللي تحت. لحد ما تتعمل، الأبلكيشن بيعرض «تحتاج تحديثًا في الموقع» ومش بيقع. الملف ده يتسلّم لجلسة السيرفر زي ما هو.

**Status: implemented on `main` in 565ec6b.** Where the server differs from what's below (the app follows the server):

- `/api/app/auth/exchange`: a banned account is `403` «هذا الحساب موقوف.».
- `/api/app/account/password`: `429` when changes are too many, `503` when the email link can't be sent; sending the already-confirmed email is not an error.
- `/api/app/account/telegram`: `429` when tries are too many, `503` when Telegram isn't reachable. `/telegram/poll`: `401` without a valid session; `{ ok: true, status: "invalid" }` when the account isn't web-only.
- `/api/app/sunnah/search`: the site's search limit (20 a minute per IP, so `429`), and at most 25 pages (`pages` ≤ 25 even when `total` is larger; `page` clamped). `/chapter/{n}` past the last page returns the last page. All `/api/app/sunnah` replies carry `Access-Control-Allow-Origin: *`.
- A wrong or expired `link_ticket` goes straight to `zekra://auth?error=expired`.
- `/api/poll`: a valid token votes as `tg:<id>` (negative for web-only accounts); an invalid one is a visitor by device.

This file is written by the app session. The server session should implement it on `main`; nothing outside `Apps/mobile` was changed by the app session. The app code that calls each endpoint is named, so shapes can be checked against it. Every app request is JSON, carries no `Origin`/cookies, and sends `Authorization: Bearer <token>` (the session JWT from `issueSession`, `src/lib/auth/app-api.ts`) when signed in. Every error reply is `{ ok: false, error: "<Arabic for the person>" }` (`appError`).

Order of value: **1** (Bearer on existing APIs, small) → **2** (Sunnah) → **3** (Google/Facebook) → **4** (account) → **5** (app links) → **6** (privacy page).

---

## 1. Accept the app's session on four existing APIs

Today these read only `initData` or the cookie (`getCurrentUser()`), so the app's token is ignored. Use `siteCaller(body.initData, request)` (`src/lib/auth/site-caller.ts`), or `bearerToken(request)` + `userFromToken`, the way `/api/me` and `/api/recap-link` already do. When a Bearer token is sent and is invalid or expired, answer as for a visitor (don't 401 the poll/room/feedback calls), except `/api/prayer-log`, which is personal-only.

| Route | Change | App code |
|---|---|---|
| `POST /api/prayer-log` | `userId` from `siteCaller(body.initData, request)`. The app already sends the token; today it gets 401 and falls back to the device. | `Apps/mobile/src/core/prayer-log.ts` |
| `POST /api/feedback` | Same, so a signed-in app user's message is linked (`userId`, `linked: true`), and the inbox can reply on Telegram. `canSendFeedback` applies. | `Apps/mobile/src/core/feedback.ts` |
| `POST /api/khatma-room` | `roomCaller(initData, device, name)` → also take the request: Bearer user → `{ taker: "tg:<id>", name: <account name>, userId }`, before the device fallback. | `Apps/mobile/src/core/rooms.ts` (`roomCall`) |
| `POST /api/poll` | `voterOf(device, initData)` → Bearer user → `tg:<id>` (the same vote as the bot and the Mini App), else `web:<device>`. | `Apps/mobile/src/components/poll-card.tsx` |

## 2. «السنة» for the app: `GET /api/app/sunnah/*`

The hadith books are ~21 MB (+ the sharh file), too big to ship in the app, so the app reads them page by page. All read-only; build only on `src/lib/hadith.ts`, `src/lib/hadith-sharh.ts` (`sharhOf`), and `src/lib/hadith-grades.ts` is applied **in the app** (send gradings as stored, in English, `[scholar, grade][]`). Text/numbers/gradings only from `data/hadith/*.json`.

- `503` when `!hadithReady()`; `404` for an unknown book/chapter/number (the app shows «غير متاح» for both, so no body is needed).
- Rate limit per IP (`limitRequest`, a new `WEB_LIMITS.sunnah` or reuse the site's), `Cache-Control: public, max-age=3600` (search: `max-age=300`). Optionally `Access-Control-Allow-Origin: *` (not needed by the app).
- Use `isHadithBook` / `isHadithSort` (never `in`), clamp `page` to ≥1, 20 items a page.

Types (as in `Apps/mobile/src/core/sunnah.ts`):

```ts
type Hadith  = { book: string; number: string; chapter: number; text: string; grades: [string, string][] };
type Chapter = { n: number; title: string; count: number };          // title: the Arabic chapter name
type Book    = { id: string; short: string; title: string; author: string; about: string; count: number; chapters: number };
type Sharh   = { id: string; title: string; explanation: string; lessons: string[]; words: [string, string][]; url: string };
type Page<T> = { page: number; pages: number; total: number; items: T[] };
```

`short`/`about` come from `HADITH_BOOKS`, `title`/`author`/`count` from `hadithBook(id)`. `Sharh` is exactly `sharhOf()`'s return value.

| Request | Reply |
|---|---|
| `GET /api/app/sunnah` | `{ books: Book[], today: Hadith \| null }` (`today` = `hadithOfTheDay()`) |
| `GET /api/app/sunnah/{book}` | `Omit<Book,"chapters"> & { chapters: Chapter[] }` (`hadithBook(id)`, each section → `{ n, title, count }`) |
| `GET /api/app/sunnah/{book}/chapter/{n}?page=&sort=` | `{ chapter: Chapter } & Page<Hadith>` (`sortHadiths(chapterHadiths(id, n), sort)` sliced) |
| `GET /api/app/sunnah/{book}/{number}` | `{ hadith, chapter: Chapter \| null, prev: string \| null, next: string \| null, sharh: Sharh \| null }` (`hadithAt`, `sharhOf(book, number)`) |
| `GET /api/app/sunnah/search?q=&book=&page=&sort=` | `Page<Hadith>` (`searchHadith(q, { book, sort, limit })`; `q` 2–100 chars after trim, else `{ page:1, pages:0, total:0, items:[] }`) |

Route layout suggestion: `src/app/api/app/sunnah/[[...path]]/route.ts` (one handler), or one file per shape. `search` must win over a book id (no book is called "search").

## 3. Google and Facebook sign-in from the app (PKCE + one-time code)

The app opens the site's OAuth in an auth browser session and waits for `zekra://auth?…` (`Apps/mobile/src/core/oauth.ts`). The session token must **never** be in a URL: the redirect carries a one-time code bound to the app's PKCE challenge, and the app exchanges it with the verifier.

### 3a. Start: `GET /auth/google?app=<challenge>` and `GET /auth/facebook?app=<challenge>`

- `challenge`: base64url (no padding) SHA-256 of the verifier, `/^[\w-]{43}$/`. Anything else → redirect to `zekra://auth?error=expired`.
- Save `app: challenge` in the existing state cookie (`GOOGLE_COOKIE` / Facebook's) instead of `next`; otherwise unchanged.

### 3b. Callback (`/auth/google/callback`, `/auth/facebook/callback`), when the cookie has `app`

Same user resolution as now (Google: verified email → existing email identity; Facebook: never trust its email), then **instead of `createSession` + redirect to the site**:

- banned → `302 zekra://auth?error=banned`
- provider not configured → `404` stays (the app shows «غير متاحة»); a failed exchange/state → `zekra://auth?error=expired`
- else create a one-time code: 32 random bytes base64url, stored **hashed** (sha256) with `{ userId, challenge, expiresAt: now + 2 min }` — a new table `app_auth_codes` (schema.ts + `bun run db:generate`), or memory in the web process (one process, fine) — and `302 zekra://auth?code=<code>`.

Use `Response.redirect` with a custom scheme, or `new Response(null, { status: 302, headers: { Location } })` if `Response.redirect` refuses it.

### 3c. `POST /api/app/auth/exchange` `{ code, verifier }`

- `limitRequest(WEB_LIMITS.login, request)`.
- Look up by sha256(code); must exist, unexpired, unused; `base64url(sha256(verifier)) === challenge` (timing-safe). Delete it on any attempt (one try).
- Not banned (`isBanned`) → `{ ok: true, token: issueSession(userId, APP_SESSION_DAYS), user: appUser(userId) }`.
- Failures: `appError("انتهت مهلة الدخول، حاول مرة أخرى.", 400)`.
- Prune expired codes with the login tokens.

### 3d. Linking Google/Facebook to the signed-in app account: `POST /api/app/account/link` `{ provider }` (Bearer)

- Bearer user required (`401 SIGNED_OUT` otherwise); `provider` ∈ `google|facebook`, configured, else `appError("هذه الطريقة غير متاحة الآن.", 404)`.
- Reply `{ ok: true, url: "/auth/<provider>?link_ticket=<ticket>" }`. The ticket: random, stored hashed with `{ userId, provider, expiresAt: now + 5 min }`, one use.
- `/auth/<provider>?link_ticket=` → consume the ticket, keep `{ link: userId, app: true }` in the state cookie (the auth browser has no site cookie, so `getCurrentUser()` can't be used for these).
- Callback with `app` + `link`: `linkIdentity(userId, provider, sub, email)` → `zekra://auth?linked=<provider>`, or `zekra://auth?error=taken` when it belongs to someone else, `?error=expired` for a bad/used ticket.

## 4. Account management for the app (all Bearer, `401 SIGNED_OUT` without a valid session)

App code: `Apps/mobile/src/core/account.ts`, screen `Apps/mobile/src/app/account.tsx` («طرق الدخول»).

### `POST /api/app/account` `{}`

```ts
{ ok: true,
  user: appUser(id),
  telegram: id > 0,
  google: boolean, facebook: boolean,      // user_identities rows
  email: string | null,                    // accountEmail(id).email when verified, else null
  username: string | null,                 // password_logins username
  hasPassword: boolean }
```

### `POST /api/app/account/password` `{ password, confirm, current?, username?, email? }`

The site's `savePassword` (+ `saveUsername` / `saveEmail` for a first password), with the same `CHANGES` limit and `ACCOUNT_ERRORS` texts:

- `password !== confirm` → «كلمتا المرور غير متطابقتين.»
- If `username` is given → `setUsername`; if `email` is given → `changeEmail` and, when `needsLink`, `sendVerifyEmail` (failures as in `saveEmail`).
- `setPassword(id, password, current)`; then `endUserSessions(id, <this token's sid>)` (sign out the others, keep the app's).
- Reply `{ ok: true }`, or `{ ok: true, pending: true, email }` when the password only works after the email link.

### `POST /api/app/account/telegram` `{}` — a web-only account adds Telegram

As the site's `startTelegramLink`, but the nonce goes to the app instead of a cookie: only for `isWebOnly(id)` (else `appError("حسابك مربوط بتيليجرام بالفعل.")`); `createPendingToken()` → `{ ok: true, token, nonce, link: linkDeepLink(bot.username, token) }`.

### `POST /api/app/account/telegram/poll` `{ token, nonce }` (Bearer = the web-only account)

As `/api/auth/link` with the nonce from the body: `tokenStatus(token, nonce)`; `"pending"`/`"invalid"` → `{ ok: true, status }`; approved → `consumeToken`, `mergeIntoTelegram(webId, tgId)`, and since the web-only user (and its sessions) is deleted, a **new** session: `{ ok: true, status: "ok", token: issueSession(tgId, APP_SESSION_DAYS), user: appUser(tgId) }`. Merge failure → `{ ok: true, status: "invalid" }`. `limitRequest(WEB_LIMITS.poll, request)`.

## 5. App Links (site links open in the app)

`app.json` now has Android `intentFilters` with `autoVerify` for `https://zekra.site` paths `/k/ /mushaf/ /surah/ /sunnah /r/ /recitations /radio /prayer /hijri /qibla /tasbeeh /khatma /asma /ali /ramadan /salat /quran-duas /recap`, and iOS `associatedDomains: applinks:zekra.site`. Android verifies them only if the site serves:

`GET https://zekra.site/.well-known/assetlinks.json` (`Content-Type: application/json`, 200, no redirect):

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "site.zekra.app",
    "sha256_cert_fingerprints": [
      "FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C"
    ]
  }
}]
```

That fingerprint is the **debug** key of the test APKs; add the release (or Play App Signing) key's fingerprint to the array when there is one — keep both.

- A route handler `src/app/.well-known/assetlinks.json/route.ts` (static) works; make sure Cloudflare doesn't redirect or challenge it.
- Later, for iOS: `/.well-known/apple-app-site-association` (no extension, `application/json`) with `{"applinks":{"details":[{"appIDs":["<TEAMID>.site.zekra.app"],"components":[{"/":"/k/*"},{"/":"/mushaf/*"},{"/":"/surah/*"},{"/":"/sunnah*"},{"/":"/r/*"}]}]}}` — needs the Apple Team ID.

## 6. `/app/privacy` — what the app now sends (please add)

- **Feedback and error reports** (`/api/feedback`): the text, the optional contact, what it's about (surah/ayah, zikr); signed in, the account.
- **Shared khatmas / «صدقة جارية»** (`/api/khatma-room`) and **polls** (`/api/poll`): a random id made on the phone and the name the person types (or the account, signed in).
- **Prayer log** (`/api/prayer-log`) and **recap** (`/api/recap-link`): only when signed in, kept in the account.
- **Google / Facebook sign-in**: the app opens the site's sign-in pages; Google/Facebook give the site the account id, name and email, as on the website.
- **Fonts and audio fetched directly by the phone**: the mushaf fonts from quran.com's CDN, the tajweed fonts from verses.quran.foundation, recitations from mp3quran.net and everyayah.com, word audio from quran.com (the phone's IP reaches them, nothing else).
- **Reminders, adhan, the Quran alarm and occasions** are scheduled on the phone; nothing is sent for them. The home-screen widget is drawn on the phone.
- **Sunnah pages** are read from the site (`/api/app/sunnah`) without any id.
