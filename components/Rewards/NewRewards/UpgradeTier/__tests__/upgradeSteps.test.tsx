import React from 'react';
import { base } from 'viem/chains';

import UpgradeFundingStatus from '@/components/Rewards/NewRewards/UpgradeTier/UpgradeFundingStatus';
import UpgradeReviewContent from '@/components/Rewards/NewRewards/UpgradeTier/UpgradeReviewContent';
import UpgradeTierContent from '@/components/Rewards/NewRewards/UpgradeTier/UpgradeTierContent';
import {
  RewardsTier,
  type TierMembershipContracts,
  type TierMembershipState,
  type TierOffer,
} from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

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
jest.mock('@/lib/utils', () => ({ formatNumber: (value: number) => String(value) }));
// Reached through the card's asset table, and never called here.
jest.mock('@/lib/wagmi', () => ({ publicClient: jest.fn() }));

const mockSubscribe = jest.fn();
jest.mock('@/hooks/useTierMembership', () => ({
  useTierMembership: () => ({ data: mockMembership, isLoading: false }),
  useTierUpgradeChainState: () => ({ data: mockChain }),
  useSubscribeToTier: () => ({ subscribe: mockSubscribe, isSubscribing: false, error: null }),
  useLockFuseForTier: () => ({ lockFuse: jest.fn(), isLocking: false, error: null }),
}));
jest.mock('@/hooks/useTierUpgradeFunding', () => ({
  useCashPayment: () => mockPayment,
  markUpgradeFundingSpent: jest.fn(),
}));
jest.mock('@/store/lifiSwapStore', () => ({
  useLifiSwapStore: (selector: (state: unknown) => unknown) =>
    selector({ activeClientTxId: 'c1', actions: { setActive: () => undefined } }),
}));
jest.mock('@/store/useTierUpgradeStore', () => ({
  useTierUpgradeStore: (selector: (state: unknown) => unknown) => selector(mockStore),
}));

const MODULE = '0x2222222222222222222222222222222222222222';
const USDC = '0x3333333333333333333333333333333333333333';
const TREASURY = '0x4444444444444444444444444444444444444444';

const contracts = (overrides: Partial<TierMembershipContracts> = {}): TierMembershipContracts => ({
  chainId: 122,
  lockAddress: null,
  lockZapAddress: null,
  subscriptionModuleAddress: MODULE,
  shareTokenAddress: null,
  wrappedNativeAddress: null,
  billingTokenAddress: USDC,
  revenueTreasuryAddress: TREASURY,
  ...overrides,
});

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

const membershipWith = (overrides: Partial<TierMembershipContracts> = {}) =>
  ({
    enabled: true,
    pointsUnlockEnabled: false,
    offers: [ultra],
    lock: { lockedFuse: 0, durationDays: 365 },
    subscription: null,
    currentTier: RewardsTier.PRIME,
    legacyFuseOnly: false,
    memberSince: null,
    contracts: contracts(overrides),
  }) as unknown as TierMembershipState;

const baseUsdc = {
  contractTickerSymbol: 'USDC',
  contractName: 'USD Coin',
  contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  balance: '250000000',
  contractDecimals: 6,
  quoteRate: 1,
  type: 'ERC20',
  chainId: base.id,
};

const arrivedSwap = {
  clientTxId: 'c1',
  txHash: '0xbridge',
  fromChainId: base.id,
  status: 'DONE',
  substatus: 'COMPLETED',
};

let mockMembership: TierMembershipState | undefined;
let mockChain: Record<string, unknown> | undefined;
let mockPayment: Record<string, unknown>;
let mockStore: Record<string, unknown>;
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
  root.root.findAllByType('Button') as {
    props: { disabled?: boolean; onPress: () => void };
  }[];

/** The step's main action — the last button on it. */
const mainButton = () => buttons()[buttons().length - 1];

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockSubscribe.mockResolvedValue({ state: {} });
  mockMembership = membershipWith();
  mockChain = { usdcAmount: 0, fuse: 0, nativeFuse: 0, wrappedFuse: 0, moduleEnabled: true };
  mockPayment = {
    tokens: [],
    token: undefined,
    payingFromFuse: true,
    needUsd: 799,
    sendUsd: 799,
    coverUsd: 0,
    coverPct: 0,
    affordable: false,
    fuseCoversFee: false,
    arrivedShortUsd: 0,
    checkingArrivedBalance: false,
    awaitingConfirm: false,
    funding: { state: 'none' },
    fuseUsdc: 0,
    billingTokenAddress: USDC,
    isLoading: false,
  };
  mockStore = {
    tier: RewardsTier.ULTRA,
    route: 'cash',
    lockAsset: 'soFUSE',
    back: jest.fn(),
    close: jest.fn(),
    review: jest.fn(),
    selectToken: jest.fn(),
    showFunding: jest.fn(),
    setRoute: jest.fn(),
  };
});
afterEach(() => act(() => root?.unmount()));

/**
 * The offer lost its treasury while the modal was open. Cash cannot be paid
 * and there is no lock, so a "Cash" route kept from before must not go on
 * offering to review or top up a purchase that cannot complete.
 */
describe('the offer step', () => {
  it('offers nothing once no route is left, whatever route was chosen before', () => {
    mockMembership = membershipWith({ revenueTreasuryAddress: null });
    mockPayment = { ...mockPayment, affordable: true };

    render(<UpgradeTierContent onTopUp={jest.fn()} />);

    expect(texts()).toContain('Tier upgrades are not available right now.');
    expect(texts()).not.toContain('Review upgrade');
    expect(texts()).not.toContain('Top up');
  });

  it('still offers the purchase while cash can be paid', () => {
    mockPayment = { ...mockPayment, affordable: true };

    render(<UpgradeTierContent onTopUp={jest.fn()} />);

    expect(texts()).toContain('Review upgrade');
  });

  /** Paid by transfer and not confirmed: the review is how it gets confirmed. */
  it('goes on to the review for a payment awaiting confirmation', () => {
    mockPayment = { ...mockPayment, awaitingConfirm: true };

    render(<UpgradeTierContent onTopUp={jest.fn()} />);

    expect(texts()).toContain('Review upgrade');
    expect(texts()).not.toContain('Top up');
  });

  /**
   * Cash was switched off after a transfer upgrade was paid and before it was
   * confirmed. The money is at the treasury, and the cash route is the only
   * way this screen confirms it — so it stays, sells nothing, and confirms.
   */
  describe('with cash switched off while a payment awaits confirmation', () => {
    const cashOff = (offer: Partial<TierOffer> = {}) => {
      mockMembership = {
        ...membershipWith({ revenueTreasuryAddress: null }),
        offers: [{ ...ultra, cashAvailable: false, annualFeeUsd: null, ...offer }],
      } as TierMembershipState;
      mockPayment = { ...mockPayment, awaitingConfirm: true };
    };

    it('keeps the cash route, and goes on to the review to confirm', () => {
      cashOff();

      render(<UpgradeTierContent onTopUp={jest.fn()} />);

      expect(texts()).not.toContain('Tier upgrades are not available right now.');
      expect(texts()).toContain('Review upgrade');
      expect(mockStore.setRoute).not.toHaveBeenCalled();
    });

    it('does not move the selection to the lock', () => {
      cashOff({ lockAvailable: true });

      render(<UpgradeTierContent onTopUp={jest.fn()} />);

      expect(mockStore.setRoute).not.toHaveBeenCalled();
      expect(texts()).toContain('Review upgrade');
    });

    it('opens on cash when nothing is chosen yet', () => {
      cashOff({ lockAvailable: true });
      mockStore.route = null;

      render(<UpgradeTierContent onTopUp={jest.fn()} />);

      expect(mockStore.setRoute).toHaveBeenCalledWith('cash');
      expect(mockStore.setRoute).not.toHaveBeenCalledWith('lock');
    });

    it('leaves a user who picked the lock on it', () => {
      cashOff({ lockAvailable: true });
      mockStore.route = 'lock';

      render(<UpgradeTierContent onTopUp={jest.fn()} />);

      expect(mockStore.setRoute).not.toHaveBeenCalled();
    });

    it('still offers nothing once nothing awaits confirmation', () => {
      cashOff();
      mockPayment = { ...mockPayment, awaitingConfirm: false };

      render(<UpgradeTierContent onTopUp={jest.fn()} />);

      expect(texts()).toContain('Tier upgrades are not available right now.');
    });
  });
});

describe('the review step', () => {
  const payingFromBase = () => {
    mockPayment = { ...mockPayment, token: baseUsdc, payingFromFuse: false, affordable: true };
  };

  /** A bridge for a purchase that cannot be completed only strands the user's USDC on Fuse. */
  it('starts no bridge for an upgrade by transfer with no treasury to pay', () => {
    payingFromBase();
    mockMembership = membershipWith({ revenueTreasuryAddress: null });

    render(<UpgradeReviewContent />);

    expect(root.root.findAllByType('BridgedCashReview')).toHaveLength(0);
  });

  it('bridges when the upgrade can be paid', () => {
    payingFromBase();

    render(<UpgradeReviewContent />);

    expect(root.root.findAllByType('BridgedCashReview')).toHaveLength(1);
  });

  it('confirms a payment awaiting confirmation, and only confirms it', async () => {
    mockPayment = { ...mockPayment, awaitingConfirm: true };

    render(<UpgradeReviewContent />);
    expect(mainButton().props.disabled).toBe(false);

    await act(async () => mainButton().props.onPress());

    expect(mockSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({ confirmPendingOnly: true }),
    );
  });

  /**
   * With the balance to pay again, a press meant to finish the earlier payment
   * still only finishes it: if that one is gone by then, paying is the next,
   * deliberate press.
   */
  it('only confirms an awaiting payment even when the balance would pay again', async () => {
    mockPayment = { ...mockPayment, awaitingConfirm: true, affordable: true };

    render(<UpgradeReviewContent />);
    await act(async () => mainButton().props.onPress());

    expect(mockSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({ confirmPendingOnly: true }),
    );
  });

  it('keeps the balance check otherwise', () => {
    render(<UpgradeReviewContent />);

    expect(mainButton().props.disabled).toBe(true);
  });

  /**
   * Cash switched off since the payment was made: no treasury, no module, no
   * price. None of them is needed to confirm a payment already made.
   */
  it('confirms a payment awaiting confirmation with cash switched off since', async () => {
    mockMembership = {
      ...membershipWith({ revenueTreasuryAddress: null, subscriptionModuleAddress: null }),
      offers: [{ ...ultra, cashAvailable: false, annualFeeUsd: null, firstYearFeeUsd: null }],
    } as TierMembershipState;
    mockPayment = { ...mockPayment, awaitingConfirm: true };

    render(<UpgradeReviewContent />);
    await act(async () => mainButton().props.onPress());

    expect(texts()).not.toContain('not available right now');
    expect(mockSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({ confirmPendingOnly: true }),
    );
  });

  it('starts no new payment with cash switched off', async () => {
    mockMembership = membershipWith({ revenueTreasuryAddress: null });
    mockPayment = { ...mockPayment, affordable: true };

    render(<UpgradeReviewContent />);
    await act(async () => mainButton().props.onPress());

    expect(mockSubscribe).not.toHaveBeenCalled();
    expect(texts()).toContain('Upgrading with an annual fee is not available right now.');
  });
});

describe('the funding status step', () => {
  const arrivedShort = (overrides: Record<string, unknown> = {}) => {
    mockPayment = {
      ...mockPayment,
      funding: { state: 'arrived', swap: arrivedSwap },
      fuseUsdc: 780,
      needUsd: 19,
      arrivedShortUsd: 19,
      ...overrides,
    };
  };

  /**
   * The upgrade was paid and only confirming it failed. The USDC has left the
   * Safe, so the balance no longer covers the fee — and Finish is the one way
   * left to confirm the payment that was made.
   */
  it('keeps Finish for an earlier payment awaiting confirmation, to confirm it only', async () => {
    mockPayment = {
      ...mockPayment,
      funding: { state: 'arrived', swap: arrivedSwap },
      awaitingConfirm: true,
    };

    render(<UpgradeFundingStatus />);
    expect(mainButton().props.disabled).toBe(false);

    await act(async () => mainButton().props.onPress());

    expect(mockSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({ confirmPendingOnly: true }),
    );
    expect(mockStore.close).toHaveBeenCalled();
  });

  it('only confirms an awaiting payment even when the USDC on Fuse covers the fee', async () => {
    mockPayment = {
      ...mockPayment,
      funding: { state: 'arrived', swap: arrivedSwap },
      awaitingConfirm: true,
      fuseCoversFee: true,
      affordable: true,
    };

    render(<UpgradeFundingStatus />);
    await act(async () => mainButton().props.onPress());

    expect(mockSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({ confirmPendingOnly: true }),
    );
  });

  it('keeps the balance check with nothing awaiting confirmation', () => {
    mockPayment = { ...mockPayment, funding: { state: 'arrived', swap: arrivedSwap } };

    render(<UpgradeFundingStatus />);

    expect(mainButton().props.disabled).toBe(true);
    expect(texts()).toContain('Checking your balance…');
  });

  it('pays normally once the USDC on Fuse covers the fee', async () => {
    mockPayment = {
      ...mockPayment,
      funding: { state: 'arrived', swap: arrivedSwap },
      fuseCoversFee: true,
      affordable: true,
    };

    render(<UpgradeFundingStatus />);
    await act(async () => mainButton().props.onPress());

    expect(mockSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({ confirmPendingOnly: false }),
    );
  });

  /**
   * A transfer upgrade's payment that landed $19 short stays $19 short:
   * nothing covers its bridge. Waiting on "Checking your balance…" gets
   * nowhere, so the screen says so and sends the user to add the rest.
   */
  it('says how short a landed payment left the upgrade, and sends the user to add the rest', () => {
    arrivedShort();

    render(<UpgradeFundingStatus />);

    expect(texts()).toContain('still $19.00 short of the $799.00 fee');
    expect(texts()).not.toContain('Checking your balance…');

    act(() => mainButton().props.onPress());
    expect(mockStore.selectToken).toHaveBeenCalled();
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  /**
   * Until a balance read asked for after the landing, the USDC may not be in
   * it yet. `useCashPayment` holds the shortfall at zero until there is one
   * (see `resolveCashPayment`), and this screen takes its word: one notion of
   * a fresh balance, shared with the offer and the review.
   */
  it('checks the balance before calling a landed payment short', () => {
    arrivedShort({ fuseUsdc: 0, needUsd: 799, arrivedShortUsd: 0, checkingArrivedBalance: true });

    render(<UpgradeFundingStatus />);

    expect(texts()).toContain('Checking your balance…');
    expect(texts()).not.toContain('short of the');
    expect(texts()).not.toContain('Add the rest');
  });

  /** Cash switched off since the payment was made: Finish still confirms it. */
  it('confirms an earlier payment with cash switched off since', async () => {
    mockMembership = membershipWith({ revenueTreasuryAddress: null });
    mockPayment = {
      ...mockPayment,
      funding: { state: 'arrived', swap: arrivedSwap },
      awaitingConfirm: true,
    };

    render(<UpgradeFundingStatus />);
    await act(async () => mainButton().props.onPress());

    expect(mockSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({ confirmPendingOnly: true }),
    );
  });

  it('starts no new payment with cash switched off', async () => {
    mockMembership = membershipWith({ revenueTreasuryAddress: null });
    mockPayment = {
      ...mockPayment,
      funding: { state: 'arrived', swap: arrivedSwap },
      fuseCoversFee: true,
      affordable: true,
    };

    render(<UpgradeFundingStatus />);
    await act(async () => mainButton().props.onPress());

    expect(mockSubscribe).not.toHaveBeenCalled();
  });
});
