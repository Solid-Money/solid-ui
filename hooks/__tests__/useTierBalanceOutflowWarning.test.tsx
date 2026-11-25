import React from 'react';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useTierBalanceOutflowWarning } from '@/hooks/useTierBalance';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
jest.mock('@/hooks/useTierMembership', () => ({
  useTierMembership: () => ({ data: { currentTier: 'core' } }),
}));
jest.mock('@/hooks/useOpenDepositFlow', () => ({ useOpenDepositFlow: () => jest.fn() }));
jest.mock('@/hooks/useToken', () => ({ useTokenPriceUsd: () => ({ data: undefined }) }));
jest.mock('@/hooks/useVaultDepositEntry', () => ({
  useVaultDepositEntry: () => ({ modal: {}, onBeforeOpen: jest.fn() }),
}));
jest.mock('@/hooks/useVaultExchangeRate', () => ({
  useVaultExchangeRate: () => ({ data: undefined }),
}));
jest.mock('@/constants/withdraw', () => ({ getVaultKey: () => 'USD' }));
jest.mock('@/lib/vaults', () => ({ isEarnShareToken: () => false }));
jest.mock('@/lib/types', () => ({ VaultType: { USDC: 'USDC' } }));

// The warning is whatever this says for the amount: a reset warning above
// $1,000 out of Earn, nothing below.
const resetWarning = { kind: 'reset', tier: 'prime' };
jest.mock('@/lib/tierBalance', () => ({
  activeTierBalance: () => ({ enabled: true }),
  relevantTrack: () => null,
  fixedPointUsd: () => 0,
  parseTokenUnits: () => 0n,
  outflowWarning: (_balance: unknown, _tier: unknown, outflowUsd: number) =>
    outflowUsd > 1000 ? resetWarning : null,
}));

const Probe = ({ outflowUsd }: { outflowUsd: number }) => {
  useTierBalanceOutflowWarning('send', outflowUsd);
  return null;
};

const shownEvents = () =>
  mockTrack.mock.calls.filter(
    ([event]) => event === TRACKING_EVENTS.TIER_BALANCE_OUTFLOW_WARNING_SHOWN,
  );

describe('useTierBalanceOutflowWarning', () => {
  beforeEach(() => mockTrack.mockClear());

  it('reports a warning once while it stays on screen', () => {
    let renderer: any;
    act(() => {
      renderer = create(<Probe outflowUsd={1500} />);
    });
    act(() => renderer.update(<Probe outflowUsd={1600} />));
    act(() => renderer.update(<Probe outflowUsd={1700} />));

    expect(shownEvents()).toHaveLength(1);
  });

  it('reports the same warning again after it went away and came back', () => {
    let renderer: any;
    act(() => {
      renderer = create(<Probe outflowUsd={1500} />);
    });
    act(() => renderer.update(<Probe outflowUsd={500} />));
    act(() => renderer.update(<Probe outflowUsd={1500} />));

    expect(shownEvents()).toHaveLength(2);
    expect(shownEvents()[1][1]).toEqual({
      route: 'balance',
      flow: 'send',
      kind: 'reset',
      tier: 'prime',
    });
  });

  it('still reports a cancel for a warning that went away before the form closed', () => {
    let renderer: any;
    act(() => {
      renderer = create(<Probe outflowUsd={1500} />);
    });
    act(() => renderer.update(<Probe outflowUsd={500} />));
    act(() => renderer.unmount());

    expect(mockTrack).toHaveBeenCalledWith(TRACKING_EVENTS.TIER_BALANCE_OUTFLOW_WARNING_CANCELLED, {
      route: 'balance',
      flow: 'send',
      kind: 'reset',
      tier: 'prime',
    });
  });
});
