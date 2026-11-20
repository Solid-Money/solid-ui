import { base, bsc, fuse, mainnet } from 'viem/chains';

import { wirexBaseDepositGate } from '@/lib/utils/wirexBaseDepositGate';

const notEnabled = { shouldOffer: true, isLoading: false };
const enabled = { shouldOffer: false, isLoading: false };
const loading = { shouldOffer: false, isLoading: true };

describe('wirexBaseDepositGate', () => {
  it('asks a cardholder who has not turned Base on to do so before any off-Fuse address', () => {
    // rulio, Nov 10 2026: 15 USDT from BNB Chain delivered to the Safe on Base,
    // which the card could not spend.
    expect(wirexBaseDepositGate(bsc.id, notEnabled)).toBe('turn-on-base');
    expect(wirexBaseDepositGate(mainnet.id, notEnabled)).toBe('turn-on-base');
    expect(wirexBaseDepositGate(base.id, notEnabled)).toBe('turn-on-base');
  });

  it('shows the address once Base is on', () => {
    expect(wirexBaseDepositGate(bsc.id, enabled)).toBe('ready');
    expect(wirexBaseDepositGate(base.id, enabled)).toBe('ready');
  });

  it('never gates Fuse, which every Wirex card spends from', () => {
    expect(wirexBaseDepositGate(fuse.id, notEnabled)).toBe('ready');
    expect(wirexBaseDepositGate(fuse.id, loading)).toBe('ready');
  });

  it('holds the address back while it is still unknown whether Base is on', () => {
    expect(wirexBaseDepositGate(bsc.id, loading)).toBe('checking');
  });

  it('shows nothing to gate before a network is chosen', () => {
    expect(wirexBaseDepositGate(undefined, notEnabled)).toBe('ready');
  });
});
