import {
  cardSweepExplorerUrl,
  cardTransactionExplorerUrl,
  formatCardAmount,
  formatCardTransactionAmount,
  getCardMerchantMapsUrl,
  getCardMerchantPlace,
  isOutgoingCardTransaction,
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

describe('getCardMerchantPlace', () => {
  it('shows the city and country alone, and keeps the address for the map', () => {
    // Rain breaks the address up; the detail row wants only the short form.
    expect(
      getCardMerchantPlace({
        merchant_city: 'Tel Aviv',
        merchant_country: 'IL',
        merchant_location: '50 Dizengoff St, Tel Aviv, Israel',
      }),
    ).toEqual({ label: 'TEL AVIV, IL', address: '50 Dizengoff St, Tel Aviv, Israel' });
  });

  it('maps by the short form when that is all the issuer sent', () => {
    expect(getCardMerchantPlace({ merchant_city: 'Tel Aviv', merchant_country: 'IL' })).toEqual({
      label: 'TEL AVIV, IL',
      address: 'Tel Aviv, IL',
    });
  });

  it('falls back to the address line when no city was resolved', () => {
    // A blank row would be worse: the address still tells the user where they were.
    expect(getCardMerchantPlace({ merchant_location: '123 Main St Tel Aviv' })).toEqual({
      label: '123 MAIN ST TEL AVIV',
      address: '123 Main St Tel Aviv',
    });
  });

  it('drops the row entirely when there is no location at all', () => {
    expect(getCardMerchantPlace({})).toBeUndefined();
    expect(getCardMerchantPlace({ merchant_city: '  ', merchant_location: '' })).toBeUndefined();
  });

  it('shows a country on its own rather than nothing', () => {
    expect(getCardMerchantPlace({ merchant_country: 'IL' })?.label).toBe('IL');
  });
});

describe('getCardMerchantMapsUrl', () => {
  const place = { label: 'TEL AVIV, IL', address: 'Tel Aviv, IL' };

  it('leads with the merchant, so the map finds the shop and not the city centre', () => {
    expect(getCardMerchantMapsUrl(place, 'mb burger')).toBe(
      'https://www.google.com/maps/search/?api=1&query=mb%20burger%2C%20Tel%20Aviv%2C%20IL',
    );
  });

  it('searches the address alone when the merchant has no name', () => {
    expect(getCardMerchantMapsUrl(place)).toBe(
      'https://www.google.com/maps/search/?api=1&query=Tel%20Aviv%2C%20IL',
    );
  });
});

/**
 * The stored sign is the ledger's — a debit is positive — which is the opposite
 * of how a statement reads. These two are what stop that reaching the screen.
 */
describe('isOutgoingCardTransaction', () => {
  it('reads a positive amount as a purchase, because that is a debit', () => {
    expect(isOutgoingCardTransaction({ amount: '100.00' })).toBe(true);
    expect(isOutgoingCardTransaction({ amount: '0' })).toBe(true);
  });

  it('reads a negative amount as money coming back', () => {
    expect(isOutgoingCardTransaction({ amount: '-100.00' })).toBe(false);
  });

  // Card rows are overwhelmingly purchases, and a purchase missing its minus
  // reads as a credit the user never received.
  it('treats an unreadable amount as a purchase', () => {
    expect(isOutgoingCardTransaction({ amount: '' })).toBe(true);
    expect(isOutgoingCardTransaction({ amount: 'nonsense' })).toBe(true);
  });
});

describe('formatCardTransactionAmount', () => {
  it('puts a minus on a purchase, whatever the currency', () => {
    expect(formatCardTransactionAmount('100.00', true)).toBe('-$100.00');
    expect(formatCardTransactionAmount('50.00', true, null, 'EUR')).toBe('-€50.00');
    // An unfamiliar code trails the figure, so the sign still leads it.
    expect(formatCardTransactionAmount('120.50', true, null, 'SEK')).toBe('-120.50 SEK');
  });

  it('puts a plus on money coming back', () => {
    expect(formatCardTransactionAmount('-100.00', false)).toBe('+$100.00');
  });

  /**
   * The whole reason direction is a parameter: a foreign charge's dollar
   * equivalent is stored unsigned and has to follow the charge it converts.
   */
  it('signs an unsigned figure by the direction it is given', () => {
    expect(formatCardTransactionAmount('31.46', true)).toBe('-$31.46');
    expect(formatCardTransactionAmount('31.46', false)).toBe('+$31.46');
  });

  it('never renders a signed zero', () => {
    expect(formatCardTransactionAmount('0', true)).toBe('$0.00');
    expect(formatCardTransactionAmount('0.00', false, null, 'EUR')).toBe('€0.00');
  });

  // `formatCardAmount` emits its own "-" for a negative input; formatting from
  // the magnitude is what keeps that from colliding with the sign chosen here.
  it('does not double the sign on an already-negative amount', () => {
    expect(formatCardTransactionAmount('-50.00', true)).toBe('-$50.00');
  });
});
