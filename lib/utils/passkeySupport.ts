/**
 * Whether this browser can create a passkey, decided before anyone is asked to.
 *
 * Signup's last step is a passkey, so a browser that cannot make one lets a
 * person verify their email and choose a username before failing every time
 * they tap Continue. Over 30 days, 0 of 25 signups from iPhone in-app browsers
 * (Instagram, Facebook, Gmail and the like) got past that step.
 *
 * Only two kinds of evidence block signup, both chosen so that nobody who could
 * have created a passkey is turned away:
 *
 * - A missing capability: not a secure context, inside a frame, or no WebAuthn
 *   API. No browser can create a passkey without these.
 * - An iOS user agent without the `Safari` token, or the Google app. Apps that
 *   embed WKWebView send WebKit's bare user agent, and WKWebView only creates
 *   passkeys for an app that is a browser or owns the site's domain. In 180 days
 *   of signups no browser in those families created a passkey.
 *
 * A site opened from the Home Screen is the exception to the second rule: it
 * sends the same bare user agent but runs on Safari's engine, with Safari's
 * passkeys, so it is let through. Android is never blocked on its user agent.
 * WebView-based browsers there differ too much (one "Android Browser" signup did
 * succeed), and the ones that cannot create a passkey are caught by the missing
 * API, or by the error the attempt itself returns.
 *
 * The previous attempt at this (`isWebView`, removed in November 2025) counted
 * every Android Chrome as a webview. That is the false positive this file is
 * written to avoid, and its tests pin the browsers that must never be blocked.
 *
 * Free of React Native and app imports so the tests can feed it plain strings.
 */

export type PasskeyBlockReason = 'insecure_context' | 'in_frame' | 'no_webauthn' | 'in_app_browser';

export type DevicePlatform = 'ios' | 'android' | 'other';

export type PasskeyBlock = {
  reason: PasskeyBlockReason;
  platform: DevicePlatform;
  /** The app whose built-in browser this is, when the user agent names it. */
  app: string | null;
  /** Inside another app's browser, so opening the link in a real browser is the fix. */
  inAppBrowser: boolean;
};

export type BrowserEnvironment = {
  userAgent: string;
  isSecureContext: boolean;
  isTopLevel: boolean;
  hasWebAuthn: boolean;
  /** `navigator.standalone`: the site was opened from the iOS Home Screen. */
  isStandalone: boolean;
  /** Touch support, which tells iPadOS apart from a Mac: both send a Mac user agent. */
  hasTouch: boolean;
};

/** Apps that name themselves in the user agent of their built-in browser. */
const IN_APP_BROWSERS: [RegExp, string][] = [
  [/\bInstagram\b/i, 'Instagram'],
  [/\bBarcelona\b/, 'Threads'],
  [/FBAN\/Messenger|FB_IAB\/MESSENGER|\bMessengerForiOS\b/i, 'Messenger'],
  [/FBAN|FBAV|FB_IAB|FB4A|FBIOS/, 'Facebook'],
  [/musical_ly|BytedanceWebview|\bTikTok\b|\btrill_/i, 'TikTok'],
  [/LinkedInApp/i, 'LinkedIn'],
  [/Snapchat/i, 'Snapchat'],
  [/\bPinterest\b/i, 'Pinterest'],
  [/\bTwitter(?:Android)?\b/i, 'X'],
  [/MicroMessenger/i, 'WeChat'],
  [/WhatsApp/i, 'WhatsApp'],
  [/Telegram/i, 'Telegram'],
  [/\bLine\//, 'LINE'],
  [/KAKAOTALK/i, 'KakaoTalk'],
  [/\bDiscord\b/i, 'Discord'],
  [/\bGSA\//, 'Google'],
];

/** Android System WebView marks itself with `wv` in the platform section. */
const ANDROID_WEBVIEW = /;\s*wv\)/;

export const getDevicePlatform = (userAgent: string, hasTouch = false): DevicePlatform => {
  if (/Android/i.test(userAgent)) return 'android';
  if (/iPhone|iPod|iPad/i.test(userAgent)) return 'ios';
  // iPadOS asks for desktop sites by default and sends a Mac user agent.
  if (/Macintosh/i.test(userAgent) && hasTouch) return 'ios';
  return 'other';
};

/** The app hosting this browser, if its user agent says so. Any platform. */
export const getInAppBrowserName = (userAgent: string): string | null =>
  IN_APP_BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;

/**
 * An iOS in-app browser that cannot create a passkey for solid.xyz.
 *
 * Mirrors `isIosWebview` from @braintree/browser-detection, which this
 * replaces: WebKit's default user agent has no `Safari` token, and every iOS
 * browser (Safari, Chrome, Firefox, Edge, DuckDuckGo, Brave, Opera) adds one.
 * The Google app adds it too but is still a WKWebView, so it is named outright.
 */
export const isIosInAppBrowser = (
  env: Pick<BrowserEnvironment, 'userAgent' | 'isStandalone' | 'hasTouch'>,
): boolean => {
  const { userAgent, isStandalone, hasTouch } = env;
  if (getDevicePlatform(userAgent, hasTouch) !== 'ios') return false;
  if (/\bGSA\//.test(userAgent)) return true;
  // Home Screen web apps run on Safari's engine and share the bare user agent.
  if (isStandalone) return false;
  return /AppleWebKit(?!.*Safari)/i.test(userAgent);
};

/** Whether this looks like another app's built-in browser. For wording only, never for blocking. */
export const isLikelyInAppBrowser = (
  env: Pick<BrowserEnvironment, 'userAgent' | 'isStandalone' | 'hasTouch'>,
): boolean =>
  isIosInAppBrowser(env) ||
  getInAppBrowserName(env.userAgent) !== null ||
  ANDROID_WEBVIEW.test(env.userAgent);

/**
 * Why this browser cannot create a passkey, or `null` when it can try.
 *
 * `null` does not promise that creation will succeed (the person can still
 * cancel, or the phone can lack a screen lock); it means nothing rules it out
 * before asking.
 */
export const getPasskeyBlock = (env: BrowserEnvironment): PasskeyBlock | null => {
  const block = (reason: PasskeyBlockReason): PasskeyBlock => ({
    reason,
    platform: getDevicePlatform(env.userAgent, env.hasTouch),
    app: getInAppBrowserName(env.userAgent),
    inAppBrowser: isLikelyInAppBrowser(env),
  });

  if (!env.isSecureContext) return block('insecure_context');
  if (!env.isTopLevel) return block('in_frame');
  if (!env.hasWebAuthn) return block('no_webauthn');
  if (isIosInAppBrowser(env)) return block('in_app_browser');
  return null;
};

/** The current browser's environment, or `null` outside one. */
export const readBrowserEnvironment = (): BrowserEnvironment | null => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;

  let isTopLevel = true;
  try {
    isTopLevel = window.self === window.top;
  } catch {
    // Reading `top` across origins throws, which is itself the answer.
    isTopLevel = false;
  }

  const hasWebAuthn =
    typeof (window as Window & { PublicKeyCredential?: unknown }).PublicKeyCredential ===
      'function' && typeof navigator.credentials?.create === 'function';

  return {
    userAgent: navigator.userAgent ?? '',
    isSecureContext: window.isSecureContext !== false,
    isTopLevel,
    hasWebAuthn,
    isStandalone: (navigator as Navigator & { standalone?: boolean }).standalone === true,
    hasTouch:
      (typeof document !== 'undefined' && 'ontouchend' in document) ||
      (navigator.maxTouchPoints ?? 0) > 1,
  };
};

/**
 * The link to give someone who has to reopen Solid in their browser.
 *
 * `from` is the path they were on, with its query: that is where a referral
 * code and campaign tags travel. Only a path on this site is accepted, so the
 * link always points at `origin`.
 */
export const buildOpenInBrowserUrl = (origin: string, from?: string | null): string => {
  const isSitePath =
    typeof from === 'string' &&
    from.startsWith('/') &&
    !from.startsWith('//') &&
    !from.includes('\\');
  return `${origin}${isSitePath ? from : '/'}`;
};
