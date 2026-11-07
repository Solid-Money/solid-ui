/// <reference types="jest" />
import { CardRefundDetails } from '@/lib/types';
import { cardRefundExplorerUrl, formatCardRefundPaid } from '@/lib/utils/cardHelpers';

const HASH = '0xabc123';

const refund = (overrides: Partial<CardRefundDetails> = {}): CardRefundDetails => ({
  status: 'paid',
  gross_usd: 40,
  paid_usd: 38.8,
  ...overrides,
});

describe('cardRefundExplorerUrl', () => {
  it('links a Base refund to Basescan', () => {
    expect(cardRefundExplorerUrl(refund({ tx_hash: HASH, chain_id: 8453 }))).toBe(
      `https://basescan.org/tx/${HASH}`,
    );
  });

  it('links a Fuse refund, and one with no chain, to the Fuse explorer', () => {
    expect(cardRefundExplorerUrl(refund({ tx_hash: HASH, chain_id: 122 }))).toBe(
      `https://explorer.fuse.io/tx/${HASH}`,
    );
    expect(cardRefundExplorerUrl(refund({ tx_hash: HASH }))).toBe(
      `https://explorer.fuse.io/tx/${HASH}`,
    );
  });

  it('links nothing on a chain it does not know', () => {
    expect(cardRefundExplorerUrl(refund({ tx_hash: HASH, chain_id: 1 }))).toBeUndefined();
  });
});

describe('formatCardRefundPaid', () => {
  it('shows a EURC refund in euros', () => {
    expect(
      formatCardRefundPaid(refund({ payout_currency: 'EUR', payout_token_amount: '15' })),
    ).toBe('€15.00');
  });

  it('rounds the EURC amount half up to the cent without floating point', () => {
    // 1.005 is 1.00499999… as a float, so toFixed(2) would show €1.00.
    expect(
      formatCardRefundPaid(refund({ payout_currency: 'EUR', payout_token_amount: '1.005' })),
    ).toBe('€1.01');
    expect(
      formatCardRefundPaid(refund({ payout_currency: 'EUR', payout_token_amount: '38.804999' })),
    ).toBe('€38.80');
  });

  it('keeps the dollar figure for USDC and Fuse refunds', () => {
    expect(
      formatCardRefundPaid(refund({ payout_currency: 'USD', payout_token_amount: '38.8' })),
    ).toBe('$38.80');
    expect(formatCardRefundPaid(refund())).toBe('$38.80');
  });

  it('falls back to dollars when the EURC amount is not a decimal', () => {
    expect(
      formatCardRefundPaid(refund({ payout_currency: 'EUR', payout_token_amount: 'n/a' })),
    ).toBe('$38.80');
  });
});
