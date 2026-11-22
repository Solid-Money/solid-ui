import React from 'react';

import AiApiDashboard from '@/components/AiApi/AiApiDashboard';
import { track } from '@/lib/analytics';

import type { AiApiOverview } from '@/lib/types/ai-api';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * "Add funds" on the AI API dashboard: always there, not only in the banner
 * shown once the Wallet runs short, so money can go in before the agents stop.
 */

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => String(name) }));
jest.mock('expo-clipboard', () => ({}));
jest.mock('@/components/Card/NewCardDetails/icons', () => ({
  CheckIcon: 'CheckIcon',
  CopyIcon: 'CopyIcon',
}));
jest.mock('@/components/Insights/SpendingBars', () => ({ DailyBars: 'DailyBars' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
// Its barrel reaches wagmi's ESM build, which does not load under jest-expo.
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/errors', () => ({ showErrorToast: jest.fn() }));
jest.mock('@/hooks/useAiApi', () => ({
  useAllowAiApiCharges: () => ({ allow: jest.fn(), isAllowing: false }),
  useRetryAiApiBilling: () => ({ mutate: jest.fn(), isPending: false }),
}));

const overview = (billing: Partial<AiApiOverview['billing']> = {}): AiApiOverview => ({
  available: true,
  cashbackRate: 0.5,
  cashbackMonthlyCapUsd: 0,
  cashbackTier: 'Core',
  cashbackSettlementDays: 7,
  baseUrl: null,
  limitOptionsUsd: [10, 50],
  maxMonthlyLimitUsd: 500,
  maxKeys: 5,
  models: [],
  defaultModel: null,
  month: { key: '2026-11', spentUsd: 3, cashbackUsd: 1.5, requests: 12, resetsAt: '2026-12-01' },
  daily: [{ day: '2026-11-01', spentUsd: 3 }],
  keys: [
    {
      id: 'k1',
      name: 'Agent',
      last4: 'abcd',
      monthlyLimitUsd: 50,
      spentThisMonthUsd: 3,
      cashbackThisMonthUsd: 1.5,
      requestsThisMonth: 12,
      status: 'active',
      lastUsedAt: null,
      createdAt: '2026-11-01T00:00:00Z',
    } as AiApiOverview['keys'][number],
  ],
  topModels: [],
  account: { paused: false, pausedReason: null, pausedAt: null },
  billing: {
    configured: true,
    chainId: 8453,
    moduleAddress: '0x0000000000000000000000000000000000000001',
    periodSeconds: 2_592_000,
    mandate: null,
    requiredMandateUsd: 50,
    needsMandate: false,
    walletBalanceUsd: 25,
    billingTokens: ['USDC'],
    openChargeUsd: 0,
    walletShort: false,
    walletShortfallUsd: 0,
    ...billing,
  },
  cashback: { pendingUsd: 0, paidUsd: 0 },
});

const render = (data: AiApiOverview, onAddFunds = jest.fn()) => {
  let tree: any;
  act(() => {
    tree = create(
      <AiApiDashboard
        overview={data}
        canCreateKey
        onOpenKey={jest.fn()}
        onNewKey={jest.fn()}
        onOpenSetup={jest.fn()}
        onOpenHowItWorks={jest.fn()}
        onOpenModels={jest.fn()}
        onAddFunds={onAddFunds}
      />,
    );
  });
  return tree;
};

const addFundsButtons = (tree: any) =>
  tree.root.findAll(
    (node: any) =>
      node.props.accessibilityRole === 'button' &&
      node.props.accessibilityLabel === 'Add funds' &&
      typeof node.props.onPress === 'function',
  );

describe('AiApiDashboard: Add funds', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is offered while the Wallet has enough, with no banner asking for it', () => {
    const onAddFunds = jest.fn();
    const tree = render(overview(), onAddFunds);

    const [button] = addFundsButtons(tree);
    expect(button).toBeDefined();
    act(() => button.props.onPress());

    expect(onAddFunds).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('ai_api_add_funds_pressed', { source: 'dashboard' });
  });

  it('stays beside the banner once the Wallet runs short', () => {
    const tree = render(overview({ walletShort: true, walletShortfallUsd: 4.2 }));
    expect(addFundsButtons(tree).length).toBeGreaterThanOrEqual(1);
  });
});
