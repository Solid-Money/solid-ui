import {
  cardSweepExplorerUrl,
  cardTransactionExplorerUrl,
  formatCardAmount,
  getCardMerchantMapsUrl,
  getCardMerchantPlace,
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
