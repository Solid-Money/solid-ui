import { PLAY_STORE_URL } from '@/constants/appStores';
import { SOLID_APP_URL } from '@/lib/config';

/**
 * A referral code as the backend issues it: upper-case letters and digits.
 * The backend matches codes case-insensitively, so anything typed or pasted is
 * upper-cased before it is checked against this.
 */
export const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{4,12}$/;

/**
 * What the invite page copies to the iOS clipboard before sending the friend to
 * the App Store. The signup screen offers to paste it back — iOS has no install
 * referrer, so this is how a code survives the install there.
 */
export const INVITE_CLIPBOARD_PREFIX = 'solid-invite:';

/** Query params a referral code has arrived under over the years. */
const REFERRAL_PARAM_NAMES = ['ref', 'refCode', 'referralCode', 'referral'] as const;

/**
 * `?referral=open` is the app's own instruction to open the referral screen
 * (`/rewards?referral=open`), not a code — and "OPEN" happens to fit the code
 * pattern. Values the app itself puts in that param are never codes.
 */
const RESERVED_REFERRAL_PARAM_VALUES = new Set(['OPEN']);

/** The code, upper-cased, or null when `raw` cannot be a referral code. */
export const normalizeReferralCode = (raw: string | null | undefined): string | null => {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(code) ? code : null;
};

/**
 * The referral code a URL's query carries, or null.
 *
 * Every param name the app has ever used is read, in order, and the first one
 * that holds a real code wins — `/rewards?referral=open` carries none.
 */
export const referralCodeFromParams = (params: URLSearchParams): string | null => {
  for (const name of REFERRAL_PARAM_NAMES) {
    const code = normalizeReferralCode(params.get(name));
    if (!code) continue;
    if (name === 'referral' && RESERVED_REFERRAL_PARAM_VALUES.has(code)) continue;
    return code;
  }
  return null;
};

/**
 * A code out of pasted text: `solid-invite:CODE` (what the invite page copies),
 * an invite link (`…/invite/CODE`), an old referral link (`…?ref=CODE`), or a
 * bare code.
 */
export const parseInviteCodeFromText = (text: string | null | undefined): string | null => {
  if (typeof text !== 'string') return null;
  const value = text.trim();
  if (!value) return null;

  if (value.toLowerCase().startsWith(INVITE_CLIPBOARD_PREFIX)) {
    return normalizeReferralCode(value.slice(INVITE_CLIPBOARD_PREFIX.length));
  }

  const inviteLink = value.match(/\/invite\/([A-Za-z0-9]+)(?:[/?#]|$)/);
  if (inviteLink) return normalizeReferralCode(inviteLink[1]);

  const queryStart = value.indexOf('?');
  if (queryStart >= 0) {
    return referralCodeFromParams(new URLSearchParams(value.slice(queryStart + 1)));
  }

  return normalizeReferralCode(value);
};

/**
 * The code in a Google Play install referrer, or null.
 *
 * The invite page sends Android users to Play with
 * `&referrer=` + encodeURIComponent('ref=CODE&utm_source=invite'), which Play
 * hands back decoded once: `ref=CODE&utm_source=invite`. Organic installs come
 * back as `utm_source=google-play&utm_medium=organic`, which carries no code.
 * A referrer that is still encoded (seen when a link is re-shared through
 * another redirect) is decoded first.
 */
export const parseInstallReferrer = (referrer: string | null | undefined): string | null => {
  if (typeof referrer !== 'string') return null;
  let value = referrer.trim();
  if (!value) return null;

  if (!value.includes('=') && /%3d/i.test(value)) {
    try {
      value = decodeURIComponent(value);
    } catch {
      return null;
    }
  }

  return referralCodeFromParams(new URLSearchParams(value.replace(/^\?/, '')));
};

/** The invite link for a code: `https://app.solid.xyz/invite/CODE`. */
export const buildInviteLink = (code: string, appUrl: string = SOLID_APP_URL): string =>
  `${appUrl.replace(/\/+$/, '')}/invite/${encodeURIComponent(code)}`;

/** The link without its scheme, the way the share bar shows it. */
export const inviteLinkLabel = (link: string): string => link.replace(/^https?:\/\//, '');

/**
 * The Play Store listing with the code as the install referrer, so the app can
 * read it back on first launch (`Application.getInstallReferrerAsync`).
 */
export const buildPlayStoreInviteUrl = (code: string, storeUrl: string = PLAY_STORE_URL): string =>
  `${storeUrl}${storeUrl.includes('?') ? '&' : '?'}referrer=${encodeURIComponent(
    `ref=${code}&utm_source=invite`,
  )}`;

/** What the invite page copies before the App Store: `solid-invite:CODE`. */
export const inviteClipboardText = (code: string): string => `${INVITE_CLIPBOARD_PREFIX}${code}`;
