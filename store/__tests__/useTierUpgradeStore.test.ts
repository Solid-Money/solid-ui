import { TIER_UPGRADE_MODAL } from '@/constants/modals';
import { DEFAULT_LOCK_ASSET } from '@/lib/tierLockPayment';
import { RewardsTier } from '@/lib/types';
import { isTierUpgradeOpen, useTierUpgradeStore } from '@/store/useTierUpgradeStore';

const store = useTierUpgradeStore;

beforeEach(() => {
  store.setState({
    currentModal: TIER_UPGRADE_MODAL.CLOSE,
    previousModal: TIER_UPGRADE_MODAL.CLOSE,
    tier: null,
    route: null,
    lockAsset: DEFAULT_LOCK_ASSET,
  });
});

it('opens on the tier it was given and closes back down', () => {
  store.getState().open(RewardsTier.ULTRA);
  expect(store.getState().tier).toBe(RewardsTier.ULTRA);
  expect(isTierUpgradeOpen(store.getState())).toBe(true);

  store.getState().close();
  expect(isTierUpgradeOpen(store.getState())).toBe(false);
});

/** The Earn screen's CTA: "upgrade", with no idea which tier that buys. */
it('opens with no tier at all, for a caller that does not know one', () => {
  store.getState().open();
  expect(store.getState().tier).toBeNull();
  expect(isTierUpgradeOpen(store.getState())).toBe(true);
});

/**
 * A route is only offered because a particular tier sells it. Ultra is
 * soFUSE-only, so a "Cash" tab carried over from Prime would be a payment
 * method the review step cannot complete.
 */
it('drops the payment route when a different tier is opened', () => {
  store.getState().open(RewardsTier.PRIME);
  store.getState().setRoute('cash');
  store.getState().open(RewardsTier.ULTRA);

  expect(store.getState().route).toBeNull();
});

it('steps forward to review and back again without closing', () => {
  store.getState().open(RewardsTier.PRIME);
  store.getState().review();
  expect(store.getState().currentModal).toBe(TIER_UPGRADE_MODAL.OPEN_REVIEW);

  store.getState().back();
  expect(store.getState().currentModal).toBe(TIER_UPGRADE_MODAL.OPEN_UPGRADE);
  expect(isTierUpgradeOpen(store.getState())).toBe(true);
});

/** What drives the slide direction in `ResponsiveModal`. */
it('records where it came from, so the step can animate the right way', () => {
  store.getState().open(RewardsTier.PRIME);
  store.getState().review();

  expect(store.getState().previousModal.number).toBeLessThan(store.getState().currentModal.number);
});

describe('the lock token', () => {
  it('opens the picker and comes back with the choice made', () => {
    store.getState().open(RewardsTier.PRIME);
    store.getState().selectToken();
    expect(store.getState().currentModal).toBe(TIER_UPGRADE_MODAL.OPEN_TOKEN_SELECTOR);

    store.getState().setLockAsset('WFUSE');
    expect(store.getState().lockAsset).toBe('WFUSE');
    // Picking one is the whole step, so it closes itself rather than leaving
    // the user to press back on a decision they have already made.
    expect(store.getState().currentModal).toBe(TIER_UPGRADE_MODAL.OPEN_UPGRADE);
  });

  /**
   * A token picked for one upgrade is not a standing preference — the balances
   * behind it have moved, and the tier being bought may be a different one.
   */
  it('goes back to the default when the flow is reopened', () => {
    store.getState().open(RewardsTier.PRIME);
    store.getState().setLockAsset('soFUSE');
    store.getState().open(RewardsTier.ULTRA);

    expect(store.getState().lockAsset).toBe(DEFAULT_LOCK_ASSET);
  });

  /** Backing out of the picker leaves the choice alone. */
  it('keeps the current token when the picker is dismissed', () => {
    store.getState().open(RewardsTier.PRIME);
    store.getState().setLockAsset('soFUSE');
    store.getState().selectToken();
    store.getState().back();

    expect(store.getState().lockAsset).toBe('soFUSE');
    expect(store.getState().currentModal).toBe(TIER_UPGRADE_MODAL.OPEN_UPGRADE);
  });
});
