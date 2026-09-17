import React from 'react';

import CardWithdrawForm from '@/components/Card/CardWithdrawForm';
import { CardProvider } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * "Withdraw from card" showed a flat `$0` with Max greyed out to cardholders
 * whose card reported a balance, and gave them nothing to act on — the reported
 * bug. Three different states reached that screen as `availableUsd ?? 0`: a
 * query that failed, one that never ran because the issuer holds no collateral,
 * and a balance the backend could not read. None of them is an answer of zero,
 * and React Query v5 reports `isLoading: false` for all three, so the user did
 * not even get a skeleton to suggest we were unsure.
 */

const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

let mockCollateralQuery: {
  data?: Record<string, unknown>;
  isLoading: boolean;
  isError: boolean;
};
let mockProvider: CardProvider | null;

jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ user: { safeAddress: '0xsafe' } }),
}));
jest.mock('@/hooks/useCardDetails', () => ({
  useCardDetails: () => ({
    data: { balances: { available: { amount: '100.00', currency: 'USD' } } },
    refetch: jest.fn(),
    isLoading: false,
  }),
}));
jest.mock('@/hooks/useCardProvider', () => ({
  useCardProvider: () => ({ provider: mockProvider, isLoading: false }),
}));
jest.mock('@/hooks/useCardCollateralAvailable', () => ({
  useCardCollateralAvailable: () => ({ ...mockCollateralQuery, refetch: jest.fn() }),
}));
jest.mock('@/hooks/useWithdrawRainCollateral', () => ({
  __esModule: true,
  default: () => ({ withdrawCollateral: jest.fn() }),
}));
jest.mock('@/store/useCardWithdrawStore', () => ({
  useCardWithdrawStore: (select: any) => select({ setModal: jest.fn(), setTransaction: jest.fn() }),
}));
jest.mock('@/lib/api', () => ({
  withdrawFromCard: jest.fn(),
  withdrawFromCardToSavings: jest.fn(),
}));
// `@/lib/utils` re-exports `lib/utils/multicall`, which pulls in wagmi's ESM
// build and does not load under jest-expo. Only three helpers are used here and
// none of them is what this file is about — which branch the screen renders is.
// `formatNumber` is stubbed to the plain number so the assertions below read as
// "the figure" rather than re-testing its formatting.
jest.mock('@/lib/utils', () => ({
  cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(' '),
  formatNumber: (value: number) => String(value),
  getCardDepositTokenSymbol: () => 'USDC',
}));
// The store itself is only imported for this enum, and it reaches MMKV (a
// native module) on the way in.
jest.mock('@/store/useCardDepositStore', () => ({
  CardDepositSource: {
    WALLET: 'wallet',
    SAVINGS: 'savings',
    EXTERNAL: 'external',
    BORROW: 'borrow',
    COLLATERAL: 'collateral',
  },
}));
jest.mock('@/components/Card/ToDestinationSelector', () => 'ToDestinationSelector');
jest.mock('@/components/Max', () => 'Max');
jest.mock('@/components/ui/skeleton', () => 'Skeleton');
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));

/** A backend response with one readable USDT asset holding `balanceUsd`. */
const collateral = (overrides: Record<string, unknown> = {}) => ({
  availableUsd: 100.53,
  availableRaw: '100530000',
  onChainCollateralUsd: 100.53,
  totalCollateralUsd: 100.53,
  spendingPowerUsd: 100.6,
  limitedBy: 'collateral',
  chainId: 42161,
  tokenAddress: USDT,
  symbol: 'USDT',
  decimals: 6,
  tokens: [
    {
      rainCollateralContractId: 'c1',
      chainId: 42161,
      collateralProxy: '0xproxy',
      tokenAddress: USDT,
      symbol: 'USDT',
      decimals: 6,
      rawBalance: '100530000',
      balanceUsd: 100.53,
    },
  ],
  ...overrides,
});

const render = () => {
  let tree: any;
  act(() => {
    tree = create(<CardWithdrawForm />);
  });
  // Joined rather than compared element by element: a figure may be one child
  // or a "$" beside its number depending on how the line is written, and this
  // file is about which figure the screen shows, not how it is spliced.
  const rendered: string = tree.root
    .findAll((node: any) => node.type === 'Text')
    .flatMap((node: any) => [node.props.children].flat(Infinity))
    .filter((child: any) => typeof child === 'string')
    .join('');
  const max = tree.root.findAll((node: any) => node.type === 'Max')[0];
  const skeletons = tree.root.findAll((node: any) => node.type === 'Skeleton');
  return { tree, rendered, max, skeletons };
};

beforeEach(() => {
  mockProvider = CardProvider.RAIN;
  mockCollateralQuery = { data: collateral(), isLoading: false, isError: false };
});

describe('CardWithdrawForm — the available figure', () => {
  it('shows the withdrawable amount when the backend read it', () => {
    const { rendered, max } = render();

    expect(rendered).toContain('$100.53');
    expect(max.props.disabled).toBe(false);
  });

  it('shows $0 when the collateral really is zero', () => {
    // The one case where zero is an answer: the read succeeded and the proxy is
    // empty. This must keep saying $0 — the fix is about the other three.
    mockCollateralQuery.data = collateral({ availableUsd: 0, onChainCollateralUsd: 0 });

    const { rendered, max } = render();

    expect(rendered).toContain('$0');
    expect(rendered).not.toContain('—');
    expect(max.props.disabled).toBe(true);
  });

  it('does not quote $0 when the collateral query failed', () => {
    // The reported screenshot: "$0" beside a greyed-out Max, no explanation, on
    // a card the app itself showed a balance for.
    mockCollateralQuery = { data: undefined, isLoading: false, isError: true };

    const { rendered, max } = render();

    expect(rendered).not.toContain('$0');
    expect(rendered).toContain('—');
    expect(max.props.disabled).toBe(true);
    expect(rendered).toContain("Couldn't load how much you can withdraw");
  });

  it('does not quote $0 when the backend could not read the balance', () => {
    mockCollateralQuery.data = collateral({
      availableUsd: 0,
      onChainCollateralUsd: 0,
      unavailableReason: 'rpc timeout',
    });

    const { rendered } = render();

    expect(rendered).not.toContain('$0');
    expect(rendered).toContain('—');
    expect(rendered).toContain("Couldn't read your USDT balance");
  });

  it('says so on a card that holds no collateral of its own', () => {
    // A Wirex card: the collateral query is Rain-only, so it never runs and the
    // screen used to settle on "$0" forever.
    mockProvider = CardProvider.WIREX;
    mockCollateralQuery = { data: undefined, isLoading: false, isError: false };

    const { rendered } = render();

    expect(rendered).not.toContain('$0');
    expect(rendered).toContain('only available on cards that hold their own balance');
  });

  it('does not blame the card when the issuer has not resolved and the read failed', () => {
    // `isRainCard` is false for two unrelated reasons — not Rain, and not known
    // yet — so `!isRainCard` alone told a Rain cardholder their card holds no
    // balance whenever the collateral query had errored while the issuer was
    // momentarily unresolved (a user switch re-keys the issuer queries, while
    // the collateral key has no userId in it and keeps its error).
    mockProvider = null;
    mockCollateralQuery = { data: undefined, isLoading: false, isError: true };

    const { rendered } = render();

    expect(rendered).toContain("Couldn't load how much you can withdraw");
    expect(rendered).not.toContain('only available on cards that hold their own balance');
  });

  it('waits rather than guessing while the issuer is still resolving', () => {
    // `resolveCardIssuer` answers null until a card exists. Reading that as
    // "not Rain" would flash the wrong copy at every Rain cardholder on open.
    mockProvider = null;
    mockCollateralQuery = { data: undefined, isLoading: false, isError: false };

    const { rendered, skeletons } = render();

    expect(skeletons.length).toBeGreaterThan(0);
    expect(rendered).not.toContain('$0');
    expect(rendered).not.toContain('—');
  });
});
