import { bsc, mainnet } from 'viem/chains';

import { getBridgeTokenDecimals } from '@/constants/bridge';

describe('getBridgeTokenDecimals', () => {
  it('returns 18 for BNB Chain USDC/USDT (Binance-Peg tokens)', () => {
    // The bug this guards against: hardcoding 6 here under-approved the pull by
    // 1e12, stranding BSC deposits at the allowance step.
    expect(getBridgeTokenDecimals(bsc.id, 'USDC')).toBe(18);
    expect(getBridgeTokenDecimals(bsc.id, 'USDT')).toBe(18);
  });

  it('defaults to 6 for chains whose USDC omits an explicit decimals (Ethereum, etc.)', () => {
    expect(getBridgeTokenDecimals(mainnet.id, 'USDC')).toBe(6);
  });

  it('defaults to 6 for an unknown token or unconfigured chain', () => {
    expect(getBridgeTokenDecimals(bsc.id, 'NOPE')).toBe(6);
    expect(getBridgeTokenDecimals(999999, 'USDC')).toBe(6);
  });
});
