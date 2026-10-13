# Error handling

How the app tells people something failed, and how a failure is traced across
GlitchTip, Loki, MongoDB, Amplitude and Intercom. Design: Figma, UI 4 ›
_Toasts & error states_. Code: `lib/errors/`, `components/Toast.tsx`,
`components/FailureSheet/`.

## Rules

1. **Never show raw error text.** Map the error to copy with `lib/errors`. The
   raw message goes to telemetry only, sanitized (no RPC URLs, API keys,
   calldata or request dumps).
2. **A failed money action gets the failure sheet, never a toast.** This covers
   move, deposit, withdraw, swap, send, repay, claim and bridge.
3. **The title says what failed** ("Couldn’t move to your card"), not "Error"
   or "Move failed".
4. **The body says what to do next, and whether money moved.** Write "Nothing
   was sent" only when the failure happened before the transaction went out.
5. **Show nothing when the user backed out** of a passkey or wallet prompt.
6. **Every reported failure has a Ref** (`9C1B-4F2A`). Contact support attaches
   it, so the user never has to paste anything.

## Which surface

| Surface | When | API |
| --- | --- | --- |
| Failure sheet (mobile bottom sheet, 440px dialog on desktop) | A money action failed | `showFailureSheet(error, { action, details, onRetry? })` |
| Toast | Feedback that blocks nothing: a background refresh, a setting, copy | `showErrorToast(error, { action, title? })` |
| Inline | A form or screen that keeps the error in state | `getUserErrorMessage(error, { action })` |
| Error screen | A render crash (root `ErrorBoundary`) | Shows a Ref and Contact support automatically |

`showError(error, { action })` picks the right surface from the action. Use it
by default in a `catch`.

### Toast spec

- **Mobile and narrow web:** top of the screen at safe-area top + 10. Full
  width with 16px margins. Swipe up to dismiss. No close button.
- **Desktop web:** bottom-right, 400px wide, 24px from the edges, with a close
  button.
- **Content:** a 36px icon badge, a title (SemiBold 15) and a body (Regular 14,
  60% opacity). Each wraps to at most 2 lines and ellipsizes past that. At most
  one action.
- **Timing:** 5s, or 8s when the toast has an action.
- **API:** `Toast.show({ type, text1, text2, props })` stays the API.
  `props.action = { label, onPress }` adds the action. `props.link` (with
  `linkText`) still works and becomes a "View" action.
- **Reported failures** get a **Get help** action that opens support with the
  Ref.

### Copy limits

These are hard caps in `lib/errors/copyLimits.ts`. Copy over a cap is cut at a
word boundary, and in dev it logs a warning. Rewrite anything that warns.

| | Max characters |
| --- | --- |
| Toast title | 48 (fits one line on a 360pt phone) |
| Toast body | 90 (two lines) |
| Toast action | 12 (one or two words) |
| Sheet title | 40 |
| Sheet body | 140 |
| Button label | 20 |

## The error Ref

The Ref is the first 8 hex characters of the GlitchTip event ID, displayed as
`XXXX-XXXX`. How the event ID is chosen:

- **One of our API calls failed:** the event ID *is* that call's
  `X-Request-Id`. The backend generates it, echoes it in the response header
  and puts it in every error body as `requestId`.
- **Anything else** (bundler, paymaster, passkey, a crash): a fresh ID is
  minted.

| System | Where the Ref and IDs live | How to search |
| --- | --- | --- |
| GlitchTip | Event ID, plus tags `error_ref`, `error_code`, `error_action`, `request_id` | `error_ref:9C1B-4F2A`, or paste the full event ID for a direct hit |
| Loki (Grafana) | Every backend log line has `rid=<request id>`. Each app report writes `Client error ref=9C1B-4F2A …` | `{namespace="solid-backend"} \|= "rid=9c1b4f2a"` or `\|= "ref=9C1B-4F2A"` |
| MongoDB | `clientErrors` (one row per shown failure, 180-day TTL). Failed `activities` carry `metadata.errorRef` / `metadata.errorEventId` | Admin portal → Support → **Error Lookup** |
| Amplitude | `Error Shown` event with `error_ref`, `error_code`, `error_kind`, `error_action`, `surface`, `request_id` | Filter on `error_ref` |
| Intercom | Contact support prefills the chat (what failed, amount, network, time, Ref, event ID). It also sets contact attributes `last_error_ref`, `last_error_event_id`, `last_error_action`, `last_error_code`, `last_error_at` | Read the conversation, or filter contacts by `last_error_ref` |
| In-house chat | For users with the `supportChat` feature, Contact support opens the native chat with an `error` context card (`{ kind: 'error', id: <event ID> }`). Solid AI reads it with `get_recent_errors` (the customer's own reports only) | The message's "from error" chip in the portal inbox links to Error Lookup |

**Why not a MongoDB ObjectId?** An ObjectId is 24 characters, embeds its
creation time and a guessable counter, and only exists once a row is written.
Most failed money actions die on the device before any row exists. A Ref
derived from the event/request ID exists the moment the failure does, and
greps directly in Loki.

**Uniqueness.** 8 hex characters is 32 bits, so a Ref can repeat over months.
That is fine because support always looks a Ref up next to the user who sent
it, and the full event ID travels with it in the chat. The admin lookup shows
every match with its user.

**What gets reported:**
- **Failure sheet:** every failure except cancelled, offline and session
  expired.
- **Toast and inline:** only unexpected kinds (`blockchain`, `server`,
  `unknown`).

Expected failures are still counted in Amplitude.

## React Query

Configured in `app/_layout.tsx` with `lib/errors/queryErrors.ts` (TanStack
Query v5 global callbacks, following TkDodo's guidance).

### Queries

- A toast appears only when a **background refetch** fails, meaning the query
  already has data on screen.
- An initial load renders its own error state instead.
- One toast per query until it succeeds again, and at most one per minute
  across the app.
- `meta: { errorToast: false }` opts a query out.
- `meta: { errorTitle: 'Couldn’t refresh your balance' }` sets the title.

### Mutations

Mutations are opt-in with `meta: { errorAction: 'card_settings' }`. The global
callback always runs and can't see a call site's own `onError` or `try/catch`,
so making it the default would double every existing error UI.

## Actions and causes

Actions live in `lib/errors/actions.ts`:

- **Money actions (failure sheet):** `move_to_card`, `card_deposit`,
  `card_withdraw`, `card_repay`, `credit_line`, `deposit`, `savings_deposit`,
  `withdraw`, `send`, `swap`, `bridge`, `claim`, `agent_fund`, `rescue_token`.
- **Everything else (toast or inline):** `card_order`, `card_activate`,
  `card_reveal`, `card_settings`, `add_to_wallet`, `kyc`, `sign_in`, `sign_up`,
  `passkey`, `account`, `referral`, `subscription`, `load`, `refresh`,
  `generic`.

Causes come from `classifyError` in `lib/errors/classify.ts`:

| Kind | Codes | Copy (body) |
| --- | --- | --- |
| `cancelled` | `USER_CANCELLED` | Nothing is shown |
| `offline` | `NETWORK_OFFLINE` | Check your connection and try again. |
| `timeout` | `REQUEST_TIMEOUT`, `HTTP_408/504`, `RECEIPT_TIMEOUT` | This took too long… / It may still go through. Check your activity before trying again. |
| `session` | `HTTP_401` | Title "Your session expired"; body "Sign in again to continue." |
| `rate_limited` | `RATE_LIMITED` | Too many attempts. Wait a minute and try again. |
| `insufficient_funds` | `INSUFFICIENT_FUNDS` | You don’t have enough balance for this… |
| `rejected` | backend `code` or `HTTP_4xx` | The backend’s own message when it reads like copy (`isSafeServerMessage`), else "Check the details and try again." |
| `blockchain` | `PAYMASTER_REJECTED`, `USEROP_AAxx`, `SIMULATION_REVERTED`, `EXECUTION_REVERTED`, `BUNDLER_REJECTED`, `RPC_ERROR`, `TX_REVERTED` | Nothing was sent. Try again in a moment. (`TX_REVERTED`: Check your activity before trying again.) |
| `server` | `HTTP_5xx` | Something went wrong on our side. Try again in a moment. |
| `unknown` | `UNKNOWN` | Try again in a moment. If it keeps happening, contact support. |

When a transaction may already have gone out (`nothingSent === false`), the
failure sheet offers **View activity** instead of **Try again**, so nobody
sends the same money twice.

## Map of errors in the app

The October 2026 audit counted:

- 143 `Toast.show` calls, 90 of them errors. 27 put a raw `error.message` in
  front of the user.
- About 25 inline displays that showed raw error text.
- 147 `throw response` sites in `lib/api.ts`.

What was migrated to `lib/errors`:

| Area | Surfaces |
| --- | --- |
| Card | Move to card (`WirexMoveFromWallet`), card deposit (internal, external, `useCardDeposit`, `card/deposit`), card withdraw, credit line, repay, reveal, Add to Apple/Google Wallet, activation (`card/ready`), KYC resume, spend registration / RTF / euro spend / repay hooks (inline), 3DS |
| Savings & earn | Withdraw (regular, fast, soETH, soFUSE), unstake, stake, deposit from Safe, yield boost claim, Merkl claim |
| Send & swap | Send review, swap button (inline), stocks quote/order (inline) |
| Deposit | Direct deposit session (native and web), bank transfer, onboarding fee |
| Auth | Sign-up passkey and account creation, OTP, login copy (`loginErrorMessage`), account recovery, email verification |
| KYC | Didit, Sumsub, Persona (bank and bridge KYC) |
| Rewards & misc | GoodDollar verify / claim / sweep, tier upgrade, referral code, agent funding / keys, token rescue, contacts, physical card order / cancel, PIN |
| Global | Root `ErrorBoundary` (Ref and Contact support instead of the raw message), React Query refetch toasts |

Activity rows marked failed now store a sanitized `metadata.error` plus the
Ref. `createActivityEvent` and `updateActivityEvent` sanitize failure text
centrally, which also covers writers not listed above.

The static error toasts that remain are preconditions and validation ("Enter
an amount", "Wallet not connected"). They carry no raw text.
