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

  it("adds the dashboard's list on top of the build's, never in place of it", () => {
    const { isTransfiProhibitedCountry } = loadCompliance('UA');
    expect(isTransfiProhibitedCountry('tr', ['TR', 'ID'])).toBe(true);
    expect(isTransfiProhibitedCountry('ua', [])).toBe(true);
    expect(isTransfiProhibitedCountry('DE', ['TR'])).toBe(false);
  });

  it('never treats an unknown country as prohibited', () => {
    expect(loadCompliance(undefined).isTransfiProhibitedCountry(undefined)).toBe(false);
  });
});
