import {
  resolveOnramperAvailability,
  resolveOnramperCountryOverride,
} from '@/lib/onramperAvailability';

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
      isGeoLoading: false,
      isVerdictLoading: false,
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
    expect(resolve({ isCountryServiceable: undefined, isVerdictLoading: true })).toMatchObject({
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
    expect(resolve({ isGeoLoading: true }).isAvailable).toBe(false);
  });

  it('runs as the overridden country and flags that it did', () => {
    const result = resolve({ countryCode: 'ZM', countryOverride: 'US' });

    expect(result).toMatchObject({
      countryCode: 'US',
      isCountryOverridden: true,
      isAvailable: true,
    });
  });

  it('stops waiting on the IP lookup once a country is overridden', () => {
    // The tester already said which country to use. Blocking on a lookup whose
    // answer is discarded would keep them out of the flow they overrode into.
    expect(resolve({ countryCode: '', countryOverride: 'US', isGeoLoading: true })).toMatchObject({
      isAvailable: true,
      isLoading: false,
    });
  });

  it('still waits for the backend verdict when overridden', () => {
    // The override substitutes the country, never the answer about it.
    expect(
      resolve({
        countryOverride: 'US',
        isCountryServiceable: undefined,
        isVerdictLoading: true,
      }),
    ).toMatchObject({ isAvailable: false, isLoading: true });
  });

  it('still hides the flow when the overridden country is not served', () => {
    // Overriding to Germany must not conjure a buy that cannot complete.
    expect(resolve({ countryOverride: 'DE', isCountryServiceable: false })).toMatchObject({
      isAvailable: false,
      isCountryOverridden: true,
    });
  });

  it('reports no override when none is set', () => {
    expect(resolve().isCountryOverridden).toBe(false);
  });

  it('normalises the country code, since Onramper expects it upper-cased', () => {
    const result = resolve({ countryCode: 'us' });

    expect(result.countryCode).toBe('US');
    expect(result.isAvailable).toBe(true);
  });
});

describe('resolveOnramperCountryOverride', () => {
  it('accepts a two-letter code on a non-production build', () => {
    expect(resolveOnramperCountryOverride('US', false)).toBe('US');
  });

  it('upper-cases and trims what the env gives it', () => {
    expect(resolveOnramperCountryOverride('  us  ', false)).toBe('US');
  });

  it('ignores the override entirely in production', () => {
    // The guard is the whole reason this is safe to ship: a value that leaks
    // into a prod build must do nothing.
    expect(resolveOnramperCountryOverride('US', true)).toBeUndefined();
  });

  it('ignores a malformed value rather than sending it upstream', () => {
    // Onramper rejects a bad country, and the flow would look broken for a
    // reason that has nothing to do with the flow.
    for (const bad of ['', '   ', 'USA', 'U', '12', 'United States']) {
      expect(resolveOnramperCountryOverride(bad, false)).toBeUndefined();
    }
  });

  it('ignores an unset env var', () => {
    expect(resolveOnramperCountryOverride(undefined, false)).toBeUndefined();
  });
});
