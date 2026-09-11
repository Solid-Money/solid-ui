import {
  resolveOnramperAvailability,
  resolveOnramperCountryOverride,
} from '@/lib/onramperAvailability';

/**
 * The gate on the "Buy crypto" row, and the country the flow quotes against.
 *
 * The region gate is deliberately gone — see `lib/onramperAvailability`. What
 * remains has to hold: the flow must stay off a platform that cannot render the
 * native checkout button, and the country must be well-formed, because Onramper
 * rejects the request otherwise.
 */
describe('resolveOnramperAvailability', () => {
  const resolve = (overrides: Partial<Parameters<typeof resolveOnramperAvailability>[0]> = {}) =>
    resolveOnramperAvailability({
      isPlatformSupported: true,
      countryCode: 'US',
      isGeoLoading: false,
      ...overrides,
    });

  it('offers the flow on iOS', () => {
    expect(resolve()).toMatchObject({ isAvailable: true, countryCode: 'US' });
  });

  it('withholds the flow off iOS', () => {
    // There is no native checkout button to render on web or Android, so this
    // gate is a hard limit rather than a policy and must survive.
    expect(resolve({ isPlatformSupported: false })).toMatchObject({ isAvailable: false });
  });

  it('offers the flow regardless of region', () => {
    // The region gate was removed: an unserved country now reaches the screen
    // and finds an empty asset list, rather than never seeing the row.
    for (const country of ['DE', 'ZM', 'ES', 'NL', 'JP']) {
      expect(resolve({ countryCode: country }).isAvailable).toBe(true);
    }
  });

  it('withholds the flow while geo is still resolving', () => {
    // Appearing and then vanishing reads as a bug; the lookup settles quickly.
    expect(resolve({ countryCode: '', isGeoLoading: true })).toMatchObject({
      isAvailable: false,
      isLoading: true,
    });
  });

  it('runs as the overridden country and flags that it did', () => {
    expect(resolve({ countryCode: 'ZM', countryOverride: 'US' })).toMatchObject({
      countryCode: 'US',
      isCountryOverridden: true,
      isAvailable: true,
    });
  });

  it('stops waiting on the IP lookup once a country is overridden', () => {
    // The tester already said which country to use; blocking on a lookup whose
    // answer is discarded would keep them out of the flow.
    expect(resolve({ countryCode: '', countryOverride: 'US', isGeoLoading: true })).toMatchObject({
      isAvailable: true,
      isLoading: false,
    });
  });

  it('reports no override when none is set', () => {
    expect(resolve().isCountryOverridden).toBe(false);
  });

  it('normalises the country code, since Onramper expects it upper-cased', () => {
    expect(resolve({ countryCode: 'us' }).countryCode).toBe('US');
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
    // Onramper rejects a bad country, and the flow would then look broken for a
    // reason that has nothing to do with the flow.
    for (const bad of ['', '   ', 'USA', 'U', '12', 'United States']) {
      expect(resolveOnramperCountryOverride(bad, false)).toBeUndefined();
    }
  });

  it('ignores an unset env var', () => {
    expect(resolveOnramperCountryOverride(undefined, false)).toBeUndefined();
  });
});
