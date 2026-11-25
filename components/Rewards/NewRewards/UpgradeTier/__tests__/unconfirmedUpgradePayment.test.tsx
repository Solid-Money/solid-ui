import React from 'react';
import { base } from 'viem/chains';

import UpgradeReviewContent from '@/components/Rewards/NewRewards/UpgradeTier/UpgradeReviewContent';
import UpgradeTierContent from '@/components/Rewards/NewRewards/UpgradeTier/UpgradeTierContent';
import {
  RewardsTier,
  type TierMembershipContracts,
  type TierMembershipState,
  type TierOffer,
} from '@/lib/types';
import { usePendingTierUpgradeStore } from '@/store/usePendingTierUpgradeStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * The path from a payment the app may have made — a transfer upgrade whose
 * send ended with no hash — to the press that settles it, with the real
 * pending store and the real `useCashPayment` between them. Only the screens'
 * leaves, the chain reads and the subscribe call itself are stand-ins.
 */

jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('lucide-react-native', () => ({ KeyRound: 'KeyRound' }));
jest.mock('react-native-toast-message', () => ({ __esModule: true, default: { show: jest.fn() } }));
jest.mock('@/components/Loading', () => ({ __esModule: true, default: 'Loading' }));
jest.mock('@/components/WalletTokenSelector', () => ({ WalletTokenButton: 'WalletTokenButton' }));
jest.mock('@/components/Swap/lifi/LifiSwapStatusView', () => ({
  __esModule: true,
  default: ({ action }: { action: React.ReactNode }) => action,
}));
jest.mock('@/components/Rewards/NewRewards/UpgradeTier/BridgedCashReview', () => ({
  __esModule: true,
  default: 'BridgedCashReview',
}));
jest.mock('@/components/Rewards/NewRewards/UpgradeTier/TierDetailRow', () => ({
  __esModule: true,
  default: 'TierDetailRow',
}));
jest.mock('@/components/Rewards/NewRewards/UpgradeTier/TierPrice', () => ({
  __esModule: true,
  default: 'TierPrice',
}));
jest.mock('@/components/Rewards/NewRewards/UpgradeTier/TierReplacementNotice', () => ({
  __esModule: true,
  default: 'TierReplacementNotice',
}));
jest.mock('@/components/Rewards/NewRewards/UpgradeTier/UpgradeRouteSwitch', () => ({
  __esModule: true,
  default: 'UpgradeRouteSwitch',
}));
jest.mock('@/components/Rewards/NewRewards/UpgradeTier/UpgradeTierHeroCard', () => ({
  __esModule: true,
  default: 'UpgradeTierHeroCard',
}));
jest.mock('@/constants/chains', () => ({ CHAIN_NAMES: { 8453: 'Base' } }));
jest.mock('@/hooks/useAnalytics', () => ({ useMaxAPY: () => ({ maxAPY: 0 }) }));
jest.mock('@/hooks/useNativePriceUsd', () => ({ useNativePriceUsd: () => 0 }));
jest.mock('@/hooks/useRewards', () => ({ useTierBenefits: () => ({ data: undefined }) }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/errors', () => ({ getUserErrorMessage: () => 'Something went wrong.' }));
jest.mock('@/lib/help/links', () => ({ openHelpLink: jest.fn() }));
jest.mock('@/lib/lockTokenRows', () => ({ lockTokenRow: () => ({}) }));
jest.mock('@/lib/utils', () => ({
  formatNumber: (value: number) => String(value),
  withRefreshToken: (call: () => unknown) => call(),
}));
jest.mock('@/lib/wagmi', () => ({ publicClient: jest.fn() }));
jest.mock('@/lib/mmvkStorage', () => {
  const memory = new Map<string, string>();
  return {
    __esModule: true,
    default: () => ({
      setItem: (key: string, value: string) => memory.set(key, value),
      getItem: (key: string) => memory.get(key) ?? null,
      removeItem: (key: string) => memory.delete(key),
    }),
  };
});

// What `useCashPayment` reads, short of the pending store.
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ user: { userId: 'user-1' } }),
}));
const mockBalances = jest.fn();
jest.mock('@/hooks/useBalances', () => ({ useBalances: () => mockBalances() }));
jest.mock('@/hooks/swap/useLifiSwapInfo', () => ({ LIFI_QUOTE_REFRESH_MS: 30_000 }));
jest.mock('@/lib/api/lifi-swap', () => ({
  fetchLifiSwapQuote: jest.fn(),
  LifiSwapApiError: class extends Error {},
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false, isFetching: false, error: null }),
}));
jest.mock('@/store/lifiSwapStore', () => ({
  useLifiSwapStore: (selector: (state: unknown) => unknown) =>
    selector({ swaps: {}, activeClientTxId: undefined, actions: { setActive: () => undefined } }),
}));

const mockSubscribe = jest.fn();
let mockChain: Record<string, unknown>;
jest.mock('@/hooks/useTierMembership', () => ({
  useTierMembership: () => ({ data: mockMembership, isLoading: false }),
  useTierUpgradeChainState: () => ({ data: mockChain }),
  useSubscribeToTier: () => ({ subscribe: mockSubscribe, isSubscribing: false, error: null }),
  useLockFuseForTier: () => ({ lockFuse: jest.fn(), isLocking: false, error: null }),
}));
let mockStore: Record<string, unknown>;
jest.mock('@/store/useTierUpgradeStore', () => ({
  useTierUpgradeStore: (selector: (state: unknown) => unknown) => selector(mockStore),
}));

const SAFE = '0x1111111111111111111111111111111111111111';
const USDC = '0x3333333333333333333333333333333333333333';
const TREASURY = '0x4444444444444444444444444444444444444444';

const contracts: TierMembershipContracts = {
  chainId: 122,
  lockAddress: null,
  lockZapAddress: null,
  subscriptionModuleAddress: '0x2222222222222222222222222222222222222222',
  shareTokenAddress: null,
  wrappedNativeAddress: null,
  billingTokenAddress: USDC,
  revenueTreasuryAddress: TREASURY,
};

/** Ultra by transfer to a Prime member, sold for cash only. */
const ultra: TierOffer = {
  tier: RewardsTier.ULTRA,
  lockFuse: 600_000,
  lockAvailable: false,
  annualFeeUsd: 999,
  firstYearFeeUsd: 799,
  mandateUsd: 999,
  cashAvailable: true,
  held: false,
  paymentMode: 'transfer',
  replacesSubscription: null,
};

const mockMembership = {
  enabled: true,
  pointsUnlockEnabled: false,
  offers: [ultra],
  lock: { lockedFuse: 0, durationDays: 365 },
  subscription: null,
  currentTier: RewardsTier.PRIME,
  legacyFuseOnly: false,
  memberSince: null,
  contracts,
} as unknown as TierMembershipState;

/** USDC on Base, enough to bridge the fee: what the screen would offer to send. */
const baseUsdc = {
  contractTickerSymbol: 'USDC',
  contractName: 'USD Coin',
  contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  balance: '2000000000',
  contractDecimals: 6,
  quoteRate: 1,
  type: 'ERC20',
  chainId: base.id,
};

/** The record a send of unknown outcome leaves: Safe and nonce, no hash. */
const KEY = `${SAFE}:7`;
const unconfirmed = () =>
  usePendingTierUpgradeStore.getState().remember({
    userId: 'user-1',
    submittedAt: Date.now(),
    tier: RewardsTier.ULTRA,
    payment: { token: USDC, to: TREASURY, units: '799000000' },
    sender: SAFE,
    nonce: '7',
    block: '45000000',
  });

let root: ReturnType<typeof create>;
const render = (element: React.ReactElement) => {
  act(() => {
    root = create(element);
  });
};
const texts = (): string =>
  root.root
    .findAllByType('Text')
    .map((node: { props: { children: React.ReactNode } }) => [node.props.children].flat().join(''))
    .join('|');
const buttons = () =>
  root.root.findAllByType('Button') as { props: { disabled?: boolean; onPress: () => void } }[];
const mainButton = () => buttons()[buttons().length - 1];

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  usePendingTierUpgradeStore.setState({ upgrades: {}, sending: {} });
  mockSubscribe.mockResolvedValue({ state: {} });
  mockBalances.mockReturnValue({ tokens: [baseUsdc], isLoading: false });
  // The payment has left the Safe: nothing like the fee is left on Fuse.
  mockChain = {
    usdc: 1_000_000n,
    usdcAmount: 1,
    fuse: 0,
    nativeFuse: 0,
    wrappedFuse: 0,
    moduleEnabled: true,
    readStartedAt: Date.now(),
  };
  mockStore = {
    tier: RewardsTier.ULTRA,
    route: 'cash',
    lockAsset: 'soFUSE',
    cashToken: null,
    back: jest.fn(),
    close: jest.fn(),
    review: jest.fn(),
    selectToken: jest.fn(),
    showFunding: jest.fn(),
    setRoute: jest.fn(),
  };
});
afterEach(() => act(() => root?.unmount()));

describe('a payment whose send ended with no hash, and a balance short of the fee', () => {
  it('goes on to the review rather than offering to top up or bridge', () => {
    unconfirmed();

    render(<UpgradeTierContent />);

    expect(texts()).toContain('Review upgrade');
    expect(texts()).not.toContain('Top up');
  });

  it('is settled by the press, which only confirms it', async () => {
    unconfirmed();

    render(<UpgradeReviewContent />);
    // Not the bridge from Base the shortfall would otherwise send.
    expect(root.root.findAllByType('BridgedCashReview')).toHaveLength(0);
    expect(mainButton().props.disabled).toBe(false);

    await act(async () => mainButton().props.onPress());

    expect(mockSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({ confirmPendingOnly: true }),
    );
  });

  /**
   * While this app is still sending it, the screen stays as a new payment's:
   * the shortfall on Fuse is bridged from Base, as before the press.
   */
  it('is not taken for a payment to confirm while it is being sent', () => {
    usePendingTierUpgradeStore.getState().setSending(KEY, true);
    unconfirmed();

    render(<UpgradeReviewContent />);

    expect(root.root.findAllByType('BridgedCashReview')).toHaveLength(1);
  });
});
