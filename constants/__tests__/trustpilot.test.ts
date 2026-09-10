/**
 * The Trustpilot constants read `process.env` at import time (Expo inlines
 * `EXPO_PUBLIC_*` at build time), so each case has to set the environment and
 * re-import the module rather than call a function with arguments.
 */
const loadModule = (env: Record<string, string | undefined>) => {
  jest.resetModules();
  const original = { ...process.env };

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@/constants/trustpilot') as typeof import('@/constants/trustpilot');
  } finally {
    process.env = original;
  }
};

const UNSET = {
  EXPO_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID: undefined,
  EXPO_PUBLIC_TRUSTPILOT_TEMPLATE_ID: undefined,
  EXPO_PUBLIC_TRUSTPILOT_DOMAIN: undefined,
  EXPO_PUBLIC_TRUSTPILOT_LOCALE: undefined,
  EXPO_PUBLIC_TRUSTPILOT_REVIEW_URL: undefined,
};

describe('Trustpilot configuration', () => {
  it('is not configured until a business unit id is set', () => {
    expect(loadModule(UNSET).isTrustpilotConfigured()).toBe(false);
  });

  it('needs nothing but the business unit id', () => {
    const module = loadModule({
      ...UNSET,
      EXPO_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID: 'abc123',
    });

    expect(module.isTrustpilotConfigured()).toBe(true);
    // The free Review Collector template, so a deploy is one variable.
    expect(module.TRUSTPILOT_TEMPLATE_ID).toBe('56278e9abfbbba0bdcd568bc');
    expect(module.TRUSTPILOT_DOMAIN).toBe('solid.xyz');
    expect(module.TRUSTPILOT_LOCALE).toBe('en-US');
  });

  it('builds the fallback review link from the configured domain', () => {
    const module = loadModule({
      ...UNSET,
      EXPO_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID: 'abc123',
      EXPO_PUBLIC_TRUSTPILOT_DOMAIN: 'staging.solid.xyz',
    });

    expect(module.TRUSTPILOT_REVIEW_URL).toBe(
      'https://www.trustpilot.com/evaluate/staging.solid.xyz',
    );
  });

  it('lets an explicit review url win over the derived one', () => {
    const module = loadModule({
      ...UNSET,
      EXPO_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID: 'abc123',
      EXPO_PUBLIC_TRUSTPILOT_REVIEW_URL: 'https://www.trustpilot.com/review/solid.xyz',
    });

    expect(module.TRUSTPILOT_REVIEW_URL).toBe('https://www.trustpilot.com/review/solid.xyz');
  });

  it('treats an empty business unit id as unconfigured', () => {
    // A `.env` line left as `EXPO_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID=` is the
    // shape this ships in, so it must read as "off" rather than render an empty
    // Trustpilot frame.
    expect(
      loadModule({
        ...UNSET,
        EXPO_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID: '',
      }).isTrustpilotConfigured(),
    ).toBe(false);
  });
});
