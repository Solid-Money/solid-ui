import {
  getAttributionChannel,
  parseAttributionFromDeepLink,
  parseAttributionFromURL,
} from '@/lib/attribution';

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));

describe('parseAttributionFromURL referral codes', () => {
  it('captures a referral code from a link', () => {
    expect(parseAttributionFromURL('https://app.solid.xyz/?ref=AB12C').referral_code).toBe('AB12C');
    expect(
      parseAttributionFromURL('https://app.solid.xyz/signup?referralCode=aB3xK').referral_code,
    ).toBe('aB3xK');
  });

  it('does not take the referral screen instruction for a code', () => {
    const parsed = parseAttributionFromURL(
      'https://app.solid.xyz/rewards?referral=open&utm_medium=push',
    );
    expect(parsed.referral_code).toBeUndefined();
    expect(parsed.referral_source).toBeUndefined();
    expect(parsed.utm_medium).toBe('push');
  });

  it('ignores values that are not codes', () => {
    expect(
      parseAttributionFromURL('https://app.solid.xyz/?ref=<script>').referral_code,
    ).toBeUndefined();
  });

  it('marks a deep link’s code as coming from the deep link', () => {
    expect(parseAttributionFromDeepLink('solid://rewards?ref=AB12C')).toMatchObject({
      referral_code: 'AB12C',
      referral_source: 'deeplink',
    });
    expect(parseAttributionFromDeepLink('solid://rewards?referral=open').referral_code).toBe(
      undefined,
    );
  });
});

describe('getAttributionChannel', () => {
  it('credits a push open to push, even over an earlier ad click', () => {
    expect(getAttributionChannel({ utm_medium: 'push' })).toBe('push');
    expect(getAttributionChannel({ utm_medium: 'push', gclid: 'g-1' })).toBe('push');
    expect(getAttributionChannel({ utm_medium: 'Push', fbclid: 'f-1' })).toBe('push');
  });

  it('still classifies ad clicks without a push medium as paid', () => {
    expect(getAttributionChannel({ gclid: 'g-1' })).toBe('paid_search');
    expect(getAttributionChannel({ fbclid: 'f-1', utm_medium: 'cpc' })).toBe('paid_social');
  });
});
