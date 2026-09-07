import { resolveOnramperAvailability } from '@/lib/onramperAvailability';

/**
 * The gate on the "Buy crypto" row. Both halves are easy to get wrong in a way
 * that only shows up in production: showing the row off iOS reaches a screen
 * with no button to render, and showing it in a country nothing prices for
 * reaches one where the quote never resolves.
 */
describe('resolveOnramperAvailability', () => {
  const resolve = (overrides: Partial<Parameters<typeof resolveOnramperAvailability>[0]> = {}) =>
    resolveOnramperAvailability({
      isPlatformSupported: true,
      countryCode: 'US',
      isCountryServiceable: true,
      isLoading: false,
      ...overrides,
    });

  it('offers the flow on iOS where the backend says buys complete', () => {
    expect(resolve()).toMatchObject({
      isAvailable: true,
      isCountrySupported: true,
      countryCode: 'US',
    });
  });

  it('withholds the flow off iOS even where buys complete', () => {
    // There is no native checkout button to render on web or Android, so the
    // country being fine is irrelevant.
    expect(resolve({ isPlatformSupported: false })).toMatchObject({
      isAvailable: false,
      isCountrySupported: true,
    });
  });

  it('withholds the flow where the backend says nothing prices', () => {
    // The EU today: Onramper advertises Apple Pay there, but no ramp quotes.
    expect(resolve({ countryCode: 'DE', isCountryServiceable: false })).toMatchObject({
      isAvailable: false,
      isCountrySupported: false,
    });
  });

  it('offers the flow anywhere the backend says buys complete, with no list to update', () => {
    // The whole point of the server verdict: the EU switching on upstream must
    // not need a client release. No country is special-cased here.
    for (const country of ['DE', 'ES', 'NL', 'IE', 'FR', 'PL', 'SE']) {
      expect(resolve({ countryCode: country, isCountryServiceable: true })).toMatchObject({
        isAvailable: true,
        isCountrySupported: true,
      });
    }
  });

  it('withholds the flow while the verdict is still unknown', () => {
    // Appearing and then vanishing reads as a bug; the lookup settles quickly.
    expect(resolve({ isCountryServiceable: undefined, isLoading: true })).toMatchObject({
      isAvailable: false,
      isLoading: true,
    });
  });

  it('treats an unresolved verdict as no, not as yes', () => {
    // `undefined` is "not answered yet", and must never read as serviceable
    // even once loading has settled.
    expect(resolve({ isCountryServiceable: undefined }).isAvailable).toBe(false);
  });

  it('stays unavailable for a serviceable country that has not resolved yet', () => {
    expect(resolve({ isLoading: true }).isAvailable).toBe(false);
  });

  it('normalises the country code, since Onramper expects it upper-cased', () => {
    const result = resolve({ countryCode: 'us' });

    expect(result.countryCode).toBe('US');
    expect(result.isAvailable).toBe(true);
  });
});
