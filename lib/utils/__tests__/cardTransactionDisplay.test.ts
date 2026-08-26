import {
  cardSweepExplorerUrl,
  cardTransactionExplorerUrl,
  formatCardAmount,
} from '@/lib/utils/cardHelpers';

describe('formatCardAmount', () => {
  it('keeps dollars when no currency is given', () => {
    // Every existing Rain/Bridge caller passes no currency; this is the contract
    // they rely on.
    expect(formatCardAmount('12.34')).toBe('$12.34');
    expect(formatCardAmount('-12.34')).toBe('-$12.34');
  });

  it('uses the symbol for a currency the card can be charged in', () => {
    expect(formatCardAmount('50.00', null, 'EUR')).toBe('€50.00');
    expect(formatCardAmount('50.00', null, 'gbp')).toBe('£50.00');
    expect(formatCardAmount('-50.00', null, 'EUR')).toBe('-€50.00');
    expect(formatCardAmount('50.00', null, 'USD')).toBe('$50.00');
  });

  it('puts an unfamiliar ISO code after the figure', () => {
    expect(formatCardAmount('120.50', null, 'SEK')).toBe('120.50 SEK');
  });

  it('leaves token symbols as dollars', () => {
    // `currency` doubles as the token symbol on crypto funding rows, and those
    // are dollar-denominated 1:1 — they must render exactly as they did before.
    expect(formatCardAmount('50', null, 'usdc')).toBe('$50.00');
    expect(formatCardAmount('50', null, 'sousd')).toBe('$50.00');
  });

  it('rounds to cents', () => {
    expect(formatCardAmount('9.999', null, 'EUR')).toBe('€10.00');
    expect(formatCardAmount('0', null, 'EUR')).toBe('€0.00');
  });
});

describe('cardTransactionExplorerUrl', () => {
  const details = { from_address: '0x1', to_address: '', tx_hash: '0xabc', chain: 'base' };

  it('sends a Base hash to Basescan', () => {
    expect(cardTransactionExplorerUrl(details)).toBe('https://basescan.org/tx/0xabc');
    expect(cardTransactionExplorerUrl({ ...details, chain: 'Base' })).toBe(
      'https://basescan.org/tx/0xabc',
    );
  });

  it('handles Base Sepolia', () => {
    expect(cardTransactionExplorerUrl({ ...details, chain: 'base-sepolia' })).toBe(
      'https://sepolia.basescan.org/tx/0xabc',
    );
  });

  it('falls back to Arbiscan, where card transactions without a chain came from', () => {
    expect(cardTransactionExplorerUrl({ ...details, chain: '' })).toBe(
      'https://arbiscan.io/tx/0xabc',
    );
    expect(cardTransactionExplorerUrl({ ...details, chain: 'arbitrum' })).toBe(
      'https://arbiscan.io/tx/0xabc',
    );
  });

  it('has no link without a hash', () => {
    expect(cardTransactionExplorerUrl(undefined)).toBeUndefined();
    expect(cardTransactionExplorerUrl({ ...details, tx_hash: '' })).toBeUndefined();
  });
});

describe('cardSweepExplorerUrl', () => {
  it('links the soUSD sweep on Fuse', () => {
    expect(cardSweepExplorerUrl({ sweep_tx_hash: '0xabc', chain_id: 122 })).toBe(
      'https://explorer.fuse.io/tx/0xabc',
    );
  });

  it('assumes Fuse when the chain is absent, since nothing else sweeps', () => {
    expect(cardSweepExplorerUrl({ sweep_tx_hash: '0xabc' })).toBe(
      'https://explorer.fuse.io/tx/0xabc',
    );
  });

  it('refuses to link a chain it does not know', () => {
    // Better no link than one pointing at an explorer where the transaction
    // does not exist.
    expect(cardSweepExplorerUrl({ sweep_tx_hash: '0xabc', chain_id: 8453 })).toBeUndefined();
  });

  it('has no link without a sweep', () => {
    expect(cardSweepExplorerUrl(undefined)).toBeUndefined();
    expect(cardSweepExplorerUrl({ state: 'held' })).toBeUndefined();
  });
});
