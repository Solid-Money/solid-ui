import { TIER_UPGRADE_MODAL } from '@/constants/modals';
import { RewardsTier } from '@/lib/types';
import { isTierUpgradeOpen, useTierUpgradeStore } from '@/store/useTierUpgradeStore';

const store = useTierUpgradeStore;

beforeEach(() => {
  store.setState({
    currentModal: TIER_UPGRADE_MODAL.CLOSE,
    previousModal: TIER_UPGRADE_MODAL.CLOSE,
    tier: null,
    route: null,
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
