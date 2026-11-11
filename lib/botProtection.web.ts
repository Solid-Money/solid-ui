/**
 * Proof that a public auth request (recovery, signup, account lookups, email
 * change) comes from a real browser on the web app: a Cloudflare Turnstile
 * token, sent as `X-Turnstile-Token`. The backend verifies it with Cloudflare
 * before mailing a code or answering a lookup (BotProtectionGuard in
 * accounts-service). Native builds use Firebase App Check (botProtection.ts).
 *
 * The widget runs invisibly (`execution: 'execute'`, `appearance:
 * 'interaction-only'`): most visitors never see it, and the few Cloudflare
 * wants to double-check get a small checkbox pinned to the bottom of the page.
 * Each token is single-use, so every protected request gets a fresh one;
 * requests are queued because one widget solves one challenge at a time.
 *
 * Never throws: with no site key configured, the script blocked, or the
 * challenge abandoned, the request goes without a token and the backend decides
 * (monitor mode logs it, enforce refuses it).
 */
import { EXPO_PUBLIC_TURNSTILE_SITE_KEY } from '@/lib/config';

export const TURNSTILE_HEADER = 'X-Turnstile-Token';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
/** Long enough for the occasional visitor asked to tick the box. */
const TOKEN_TIMEOUT_MS = 30_000;
/**
 * A stalled script download fires neither onload nor onerror; without a limit
 * it would hold this request, and every one queued behind it, forever.
 */
const SCRIPT_TIMEOUT_MS = 10_000;

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string | undefined;
  execute(widgetId: string): void;
  reset(widgetId: string): void;
}

type TurnstileWindow = Window & { turnstile?: TurnstileApi };

let scriptLoading: Promise<TurnstileApi> | null = null;
let widgetId: string | undefined;
/** Settles the challenge in flight, from the widget's callbacks. */
let settleInFlight: ((token: string | null) => void) | null = null;
let queue: Promise<unknown> = Promise.resolve();

function loadTurnstile(): Promise<TurnstileApi> {
  const existing = (window as TurnstileWindow).turnstile;
  if (existing) return Promise.resolve(existing);

  scriptLoading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      script.onload = null;
      script.onerror = null;
      reject(new Error('Turnstile script timed out'));
    }, SCRIPT_TIMEOUT_MS);
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      const api = (window as TurnstileWindow).turnstile;
      if (api) resolve(api);
      else reject(new Error('Turnstile script loaded without its API'));
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Turnstile script failed to load'));
    };
    document.head.appendChild(script);
  }).catch(error => {
    // A blocked script (ad blocker, offline) is retried on the next request.
    scriptLoading = null;
    throw error;
  });
  return scriptLoading;
}

function solve(turnstile: TurnstileApi): Promise<string | null> {
  return new Promise(resolve => {
    const timer = setTimeout(() => finish(null), TOKEN_TIMEOUT_MS);
    function finish(token: string | null) {
      if (settleInFlight !== finish) return;
      settleInFlight = null;
      clearTimeout(timer);
      resolve(token);
    }
    settleInFlight = finish;

    if (widgetId === undefined) {
      const container = document.createElement('div');
      container.setAttribute('data-testid', 'turnstile-widget');
      Object.assign(container.style, {
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '2147483647',
      });
      document.body.appendChild(container);
      widgetId = turnstile.render(container, {
        sitekey: EXPO_PUBLIC_TURNSTILE_SITE_KEY,
        execution: 'execute',
        appearance: 'interaction-only',
        callback: (token: string) => settleInFlight?.(token),
        'error-callback': () => {
          settleInFlight?.(null);
          // Handled: don't let Turnstile throw it to the console.
          return true;
        },
        'expired-callback': () => settleInFlight?.(null),
        'timeout-callback': () => settleInFlight?.(null),
      });
      if (widgetId === undefined) {
        finish(null);
        return;
      }
    } else {
      // The last token was spent; a new challenge needs a reset first.
      turnstile.reset(widgetId);
    }
    turnstile.execute(widgetId);
  });
}

/** Headers proving this request comes from a real browser; `{}` when that can't be shown. */
export async function getBotProtectionHeaders(): Promise<Record<string, string>> {
  if (!EXPO_PUBLIC_TURNSTILE_SITE_KEY || typeof window === 'undefined') return {};

  const run = queue
    .then(async () => solve(await loadTurnstile()))
    .catch(error => {
      console.warn('[botProtection] Turnstile unavailable:', error);
      return null;
    });
  queue = run;
  const token = await run;
  return token ? { [TURNSTILE_HEADER]: token } : {};
}

/** Test seam: forget the loaded script and rendered widget. */
export function resetBotProtectionForTests() {
  scriptLoading = null;
  widgetId = undefined;
  settleInFlight = null;
  queue = Promise.resolve();
}
