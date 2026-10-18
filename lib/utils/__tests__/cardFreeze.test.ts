import { CardStatus, FreezeInitiator } from '@/lib/types';
import { canToggleCardFreeze, isCardFrozenBySolidError } from '@/lib/utils/cardHelpers';

/**
 * The card screens hide the Freeze/Unfreeze action entirely when this says no,
 * so both directions matter: a customer locked out of their own freeze has to
 * call support, and a customer let into a compliance freeze defeats it.
 */
describe('canToggleCardFreeze', () => {
  const freeze = (initiator: FreezeInitiator) => ({
    initiator,
    card_account_id: 'card-1',
    reason: 'other' as never,
    created_at: '2026-08-16T00:00:00.000Z',
  });

  const card = (status: CardStatus, freezes: ReturnType<typeof freeze>[] = []) =>
    ({ status, freezes }) as never;

  it('offers Freeze on a live card', () => {
    expect(canToggleCardFreeze(card(CardStatus.ACTIVE))).toBe(true);
  });

  it('offers Unfreeze on the customer’s own freeze', () => {
    expect(canToggleCardFreeze(card(CardStatus.FROZEN, [freeze(FreezeInitiator.CUSTOMER)]))).toBe(
      true,
    );
  });

  it('hides the toggle on a freeze the provider put on', () => {
    expect(canToggleCardFreeze(card(CardStatus.FROZEN, [freeze(FreezeInitiator.BRIDGE)]))).toBe(
      false,
    );
    expect(canToggleCardFreeze(card(CardStatus.FROZEN, [freeze(FreezeInitiator.DEVELOPER)]))).toBe(
      false,
    );
  });

  it('hides the toggle when nothing is on file for a frozen card', () => {
    // Rain and Wirex return no freeze records; the backend synthesises one and
    // attributes anything it can't account for to the provider. An empty list is
    // "we don't know", which is not permission.
    expect(canToggleCardFreeze(card(CardStatus.FROZEN))).toBe(false);
  });

  it('offers Freeze before the card details have loaded', () => {
    // An unloaded card is not a frozen one — the row should render its default
    // action rather than dropping a column and reflowing once data arrives.
    expect(canToggleCardFreeze(undefined)).toBe(true);
  });
});

/**
 * The backend refuses a customer unfreeze of a freeze Solid placed. The app
 * must tell that apart from a transient failure, or it asks the cardholder to
 * retry something that can never succeed.
 */
describe('isCardFrozenBySolidError', () => {
  const response = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  it('recognises the refusal on the raw response unfreezeCard throws', async () => {
    await expect(
      isCardFrozenBySolidError(response(403, { code: 'CARD_FROZEN_BY_SOLID', message: 'x' })),
    ).resolves.toBe(true);
  });

  it('leaves the response body readable for the caller', async () => {
    const res = response(403, { code: 'CARD_FROZEN_BY_SOLID' });

    await isCardFrozenBySolidError(res);

    await expect(res.json()).resolves.toEqual({ code: 'CARD_FROZEN_BY_SOLID' });
  });

  it('does not mistake other failures for it', async () => {
    await expect(isCardFrozenBySolidError(response(403, { code: 'OTHER' }))).resolves.toBe(false);
    await expect(
      isCardFrozenBySolidError(response(500, { code: 'CARD_FROZEN_BY_SOLID' })),
    ).resolves.toBe(false);
    await expect(isCardFrozenBySolidError(new TypeError('Network request failed'))).resolves.toBe(
      false,
    );
  });
});
