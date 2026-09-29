const loadCompliance = (value: string | undefined): typeof import('@/constants/compliance') => {
  let compliance!: typeof import('@/constants/compliance');
  jest.isolateModules(() => {
    jest.doMock('@/lib/config', () => ({ EXPO_PUBLIC_TRANSFI_PROHIBITED_COUNTRIES: value }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh module per env value
    compliance = require('@/constants/compliance');
  });
  return compliance;
};

describe('TRANSFI_PROHIBITED_COUNTRIES', () => {
  afterEach(() => jest.dontMock('@/lib/config'));

  it('falls back to UA, RU and BY when the env var is unset', () => {
    expect(loadCompliance(undefined).TRANSFI_PROHIBITED_COUNTRIES).toEqual(['UA', 'RU', 'BY']);
  });

  it('parses a comma-separated list, trimming and upper-casing each code', () => {
    const { TRANSFI_PROHIBITED_COUNTRIES, isTransfiProhibitedCountry } =
      loadCompliance(' ua, ru ,,IR ');
    expect(TRANSFI_PROHIBITED_COUNTRIES).toEqual(['UA', 'RU', 'IR']);
    expect(isTransfiProhibitedCountry('ir')).toBe(true);
    expect(isTransfiProhibitedCountry('BY')).toBe(false);
  });

  it('blocks nothing when the env var is set empty', () => {
    expect(loadCompliance('').TRANSFI_PROHIBITED_COUNTRIES).toEqual([]);
  });

  it('never treats an unknown country as prohibited', () => {
    expect(loadCompliance(undefined).isTransfiProhibitedCountry(undefined)).toBe(false);
  });
});
