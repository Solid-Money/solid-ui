import { arbitrum, base, fuse, mainnet, polygon } from 'viem/chains';

import { RHINO_ASSETS, RHINO_ASSETS_WITH_AI_API } from '@/lib/__tests__/rhinoFixtures';
import {
  AI_API_FUND_CHAIN_IDS,
  AI_API_FUND_TOKENS,
  AI_API_RHINO_DESTINATION,
  formatAiApiShortfall,
  getAiApiFundChips,
  isAiApiOwnRow,
} from '@/lib/aiApiFunding';
import {
  describeRhinoArrival,
  isRhinoDepositComplete,
  isRhinoPayoutFinal,
  resolveRhinoRow,
  RhinoAssetsState,
} from '@/lib/rhinoDeposit';

/**
 * Funding the AI API: charges are paid from USDC in the Wallet on Base, so
 * every way in has to end there as USDC.
 */

const READY: RhinoAssetsState = { status: 'ready', assets: RHINO_ASSETS_WITH_AI_API };
const NAMES: Record<number, string> = {
  [mainnet.id]: 'Ethereum',
  [polygon.id]: 'Polygon',
  [base.id]: 'Base',
  [arbitrum.id]: 'Arbitrum',
};
const appChainName = (chainId: number) => NAMES[chainId];

const row = (chainId: number, symbol: string, state: RhinoAssetsState = READY) =>
  resolveRhinoRow(state, { chainId, destinationType: AI_API_RHINO_DESTINATION, symbol });

describe('what can be sent for the AI API', () => {
  it('takes dollars, ETH and BTC, all of which arrive as USDC, and never EURC', () => {
    expect(AI_API_FUND_TOKENS).toEqual(['USDC', 'USDT', 'ETH', 'BTC']);
    expect(AI_API_FUND_TOKENS).not.toContain('EURC');
  });

  it('lists no Fuse row: rhino.fi does not take it, and money there cannot pay', () => {
    expect(AI_API_FUND_CHAIN_IDS).not.toContain(fuse.id);
    expect(AI_API_FUND_CHAIN_IDS).toContain(base.id);
  });
});

describe('isAiApiOwnRow', () => {
  it('takes USDC on Base at the Wallet itself: it is already what pays', () => {
    expect(isAiApiOwnRow(base.id, 'USDC')).toBe(true);
  });

  it('takes nothing else at an address of ours', () => {
    expect(isAiApiOwnRow(base.id, 'USDT')).toBe(false);
    expect(isAiApiOwnRow(base.id, 'ETH')).toBe(false);
    expect(isAiApiOwnRow(fuse.id, 'USDC')).toBe(false);
    expect(isAiApiOwnRow(mainnet.id, 'USDC')).toBe(false);
  });
});

describe('the AI API rows, as rhino.fi serves them', () => {
  it('gives USDC on Base to our own address, where it already is', () => {
    expect(row(base.id, 'USDC')).toEqual({ kind: 'own' });
  });

  it('sends ETH on Base through rhino.fi, which converts it to USDC', () => {
    expect(row(base.id, 'ETH')).toEqual({
      kind: 'rhino',
      selection: {
        chain: 'BASE',
        chainId: base.id,
        tokenSymbol: 'ETH',
        destinationType: 'AI_API',
      },
    });
  });

  it('offers no USDT on Base, which only our own pipeline takes and the AI API cannot charge', () => {
    expect(row(base.id, 'USDT')).toEqual({ kind: 'none' });
  });

  it('sends dollars from another chain through rhino.fi', () => {
    expect(row(polygon.id, 'USDT')).toMatchObject({
      kind: 'rhino',
      selection: { chain: 'MATIC_POS', destinationType: 'AI_API' },
    });
  });

  it('offers nothing from a backend without the AI API route, but USDC on Base', () => {
    const older: RhinoAssetsState = { status: 'ready', assets: RHINO_ASSETS };
    expect(row(mainnet.id, 'USDC', older)).toEqual({ kind: 'none' });
    expect(row(base.id, 'ETH', older)).toEqual({ kind: 'none' });
    // Already what pays, so the Wallet's own address takes it, routes or not.
    expect(row(base.id, 'USDC', older)).toEqual({ kind: 'own' });
  });

  it('never makes USDC on Base wait for rhino.fi’s routes', () => {
    expect(row(base.id, 'USDC', { status: 'loading' })).toEqual({ kind: 'own' });
    expect(row(polygon.id, 'USDC', { status: 'loading' })).toEqual({ kind: 'loading' });
  });
});

describe('getAiApiFundChips', () => {
  it('names the first two networks by the app’s own names, then how many more', () => {
    const chips = getAiApiFundChips(RHINO_ASSETS_WITH_AI_API, 'USDC', appChainName);
    expect(chips.slice(0, 2)).toEqual(['Ethereum', 'Polygon']);
    expect(chips[2]).toMatch(/^\+\d+$/);
  });

  it('never names Fuse', () => {
    const chips = getAiApiFundChips(RHINO_ASSETS_WITH_AI_API, 'USDT', appChainName);
    expect(chips).not.toContain('Fuse');
  });

  it('names nothing before rhino.fi’s routes are in', () => {
    expect(getAiApiFundChips(undefined, 'USDC', appChainName)).toEqual([]);
  });
});

describe('a deposit sent for the AI API', () => {
  it('is complete once rhino.fi pays the Wallet: nothing of ours comes after', () => {
    const deposit = { destinationType: 'AI_API' as const, receiveSymbol: 'USDC' };
    expect(isRhinoPayoutFinal(deposit)).toBe(true);
    expect(isRhinoDepositComplete({ ...deposit, status: 'EXECUTED' })).toBe(true);
    expect(isRhinoDepositComplete({ ...deposit, status: 'ACCEPTED' })).toBe(false);
  });

  it('says it is converted to USDC in the wallet that pays for the agents', () => {
    expect(
      describeRhinoArrival({
        tokenSymbol: 'ETH',
        receiveSymbol: 'USDC',
        receiveChainId: base.id,
        destinationType: 'AI_API',
      }),
    ).toBe('Converted to USDC in your wallet on Base, which pays for your AI agents');
  });
});

describe('formatAiApiShortfall', () => {
  it('names the amount to add, to the cent', () => {
    expect(formatAiApiShortfall(2.2)).toBe('Add at least $2.20 to start your agents again.');
  });

  it('says nothing when nothing is missing, or the backend cannot tell', () => {
    expect(formatAiApiShortfall(0)).toBeUndefined();
    expect(formatAiApiShortfall(null)).toBeUndefined();
    expect(formatAiApiShortfall(undefined)).toBeUndefined();
  });
});
