import { CardDetailsRevealResponse, WirexRevealSessionResponse } from '@/lib/types';

/**
 * The Wirex card-reveal protocol, run DIRECTLY against Wirex from the device.
 *
 * Wirex gates sensitive card data behind an explicit user confirmation: the user
 * signs `By signing this I confirm that I am executing action GetCardDetails at
 * {nonce}` with the wallet the card belongs to, and that signature is exchanged
 * for a single-purpose `action_token` valid for 5 minutes.
 *
 * The reads go straight to Wirex rather than through our backend on purpose —
 * Wirex permits proxying cardholder data only through a PCI DSS compliant
 * backend, so the PAN must reach the device without an intermediate hop. This
 * mirrors the Rain flow, where the backend only ever handles ciphertext.
 *
 * Kept in a leaf module (types only) so the protocol is unit testable: `lib/api`
 * transitively imports Sentry, AsyncStorage and animated assets, none of which
 * load under jest-expo.
 *
 * @see https://docs.wirexapp.com/docs/card-details
 */

/** Placeholder the backend leaves in `messageTemplate` for the signing timestamp. */
const NONCE_PLACEHOLDER = '{nonce}';

/**
 * Pull the actionable cause out of a Wirex error body.
 *
 * Wirex keeps `error_description` generic ("Request failed validation") and hides
 * the real reason in `error_details` — `signature: invalid_signature`,
 * `nonce: expired`, `card_status: not_active`. Without unpacking it, every
 * failure looks identical to the user and to us.
 */
export const describeWirexError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = await response.json();
    const details: string = Array.isArray(body?.error_details)
      ? body.error_details
          .map((d: { key?: string; details?: string }) =>
            [d?.key, d?.details].filter(Boolean).join(': '),
          )
          .filter(Boolean)
          .join('; ')
      : '';
    const base = body?.error_description || body?.error_reason || fallback;
    return details ? `${base} (${details})` : base;
  } catch {
    return fallback;
  }
};

/**
 * Confirm with a wallet signature, then read the PAN, expiry and CVV from Wirex.
 *
 * @param session Short-lived, user-scoped Wirex session from our backend.
 * @param signMessage Signs with the card's own wallet (passkey-gated), which is
 *   what makes the prompt a genuine user confirmation.
 */
export const revealWirexCardWithSession = async (
  session: WirexRevealSessionResponse,
  signMessage: (message: string) => Promise<string>,
): Promise<CardDetailsRevealResponse> => {
  // Wirex rejects a nonce older than 5 minutes, so it is stamped immediately
  // before signing — not when the session was minted.
  const nonce = Math.floor(Date.now() / 1000);
  const message = session.messageTemplate.replace(NONCE_PLACEHOLDER, String(nonce));
  const signature = await signMessage(message);

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Chain-Id': session.chainId,
    // Sent alongside the user token so the request is unambiguous about whose
    // card is being read.
    'X-User-Wallet': session.walletAddress,
    'Content-Type': 'application/json',
  };

  const confirmation = await fetch(`${session.apiBaseUrl}/api/v1/confirmation/signature/verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action_type: session.actionType,
      message_signature: signature,
      nonce,
    }),
  });

  if (!confirmation.ok) {
    throw new Error(
      await describeWirexError(
        confirmation,
        'Could not confirm your identity with the card issuer',
      ),
    );
  }

  const { action_token: actionToken } = await confirmation.json();
  if (!actionToken) throw new Error('Card issuer did not return a confirmation token');

  const readSecret = (path: 'details' | 'cvv') =>
    fetch(`${session.apiBaseUrl}/api/v1/cards/${session.cardId}/${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action_token: actionToken }),
    });

  // Sequential, not parallel: Wirex documents the action token as reusable across
  // the PAN/CVV/PIN endpoints but also as single-use, so two concurrent requests
  // could race for it. One token means the user signs once.
  const panResponse = await readSecret('details');
  if (!panResponse.ok) {
    throw new Error(await describeWirexError(panResponse, 'Could not read your card details'));
  }
  const { card_number, expiry_date } = await panResponse.json();

  // A card is far less useful online without its CVV, but a PAN without one still
  // beats failing the whole reveal, so this stays best-effort.
  let cvv = '';
  const cvvResponse = await readSecret('cvv');
  if (cvvResponse.ok) {
    cvv = (await cvvResponse.json())?.cvv ?? '';
  } else {
    console.warn('Wirex CVV read failed:', await describeWirexError(cvvResponse, 'unknown error'));
  }

  return {
    card_number,
    card_security_code: cvv,
    expiry_date,
  };
};
