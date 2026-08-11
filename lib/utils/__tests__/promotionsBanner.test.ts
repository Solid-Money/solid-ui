import {
  filterPromotionsBanners,
  matchesBannerPage,
  matchesBannerPlatform,
  matchesBannerVersion,
  normalizeBannerPage,
  type PromotionsBannerContext,
} from '@/lib/utils/promotionsBanner';

import type { PromotionsBannerItem } from '@/lib/types';

const nativeContext = (
  overrides: Partial<PromotionsBannerContext> = {},
): PromotionsBannerContext => ({
  platform: 'ios',
  appVersion: '2.0.0',
  pathname: '/',
  ...overrides,
});

const banner = (overrides: Partial<PromotionsBannerItem> = {}): PromotionsBannerItem => ({
  imageURL: 'https://cdn.test/banner.png',
  slug: 'cashback',
  sort: 0,
  ...overrides,
});

describe('matchesBannerVersion', () => {
  it('shows banners with no version gate on every build', () => {
    expect(matchesBannerVersion(undefined, nativeContext())).toBe(true);
    expect(matchesBannerVersion('', nativeContext())).toBe(true);
    expect(matchesBannerVersion('  ', nativeContext({ appVersion: null }))).toBe(true);
  });

  it('matches ">=" against the installed version and everything newer', () => {
    expect(matchesBannerVersion('>=2.0.0', nativeContext({ appVersion: '2.0.0' }))).toBe(true);
    expect(matchesBannerVersion('>=2.0.0', nativeContext({ appVersion: '2.0.1' }))).toBe(true);
    expect(matchesBannerVersion('>=2.0.0', nativeContext({ appVersion: '2.1.0' }))).toBe(true);
    expect(matchesBannerVersion('>=2.0.0', nativeContext({ appVersion: '10.0.0' }))).toBe(true);
    expect(matchesBannerVersion('>=2.0.0', nativeContext({ appVersion: '1.0.12' }))).toBe(false);
    expect(matchesBannerVersion('>=2.0.0', nativeContext({ appVersion: '1.9.9' }))).toBe(false);
  });

  it('compares segments numerically rather than as strings', () => {
    expect(matchesBannerVersion('>=2.9.0', nativeContext({ appVersion: '2.10.0' }))).toBe(true);
    expect(matchesBannerVersion('>=1.0.9', nativeContext({ appVersion: '1.0.12' }))).toBe(true);
  });

  it('pins a bare version to that build only', () => {
    expect(matchesBannerVersion('1.0.12', nativeContext({ appVersion: '1.0.12' }))).toBe(true);
    expect(matchesBannerVersion('=1.0.12', nativeContext({ appVersion: '1.0.12' }))).toBe(true);
    expect(matchesBannerVersion('1.0.12', nativeContext({ appVersion: '1.0.13' }))).toBe(false);
    expect(matchesBannerVersion('1.0.12', nativeContext({ appVersion: '2.0.0' }))).toBe(false);
  });

  it('supports the remaining comparators', () => {
    expect(matchesBannerVersion('>1.0.12', nativeContext({ appVersion: '1.0.13' }))).toBe(true);
    expect(matchesBannerVersion('>1.0.12', nativeContext({ appVersion: '1.0.12' }))).toBe(false);
    expect(matchesBannerVersion('<=2.0.0', nativeContext({ appVersion: '2.0.0' }))).toBe(true);
    expect(matchesBannerVersion('<2.0.0', nativeContext({ appVersion: '2.0.0' }))).toBe(false);
    expect(matchesBannerVersion('<2.0.0', nativeContext({ appVersion: '1.9.0' }))).toBe(true);
  });

  it('pads versions an admin shortened', () => {
    expect(matchesBannerVersion('>=2', nativeContext({ appVersion: '2.0.0' }))).toBe(true);
    expect(matchesBannerVersion('>=2.1', nativeContext({ appVersion: '2.0.9' }))).toBe(false);
    expect(matchesBannerVersion('>= 2.0.0', nativeContext({ appVersion: '2.0.0' }))).toBe(true);
  });

  it('ignores the gate on web, which always runs the latest build', () => {
    const web = nativeContext({ platform: 'web', appVersion: null });
    expect(matchesBannerVersion('>=2.0.0', web)).toBe(true);
    expect(matchesBannerVersion('1.0.12', web)).toBe(true);
  });

  it('hides the banner when the gate or the installed version is unreadable', () => {
    expect(matchesBannerVersion('^2.0.0', nativeContext())).toBe(false);
    expect(matchesBannerVersion('latest', nativeContext())).toBe(false);
    expect(matchesBannerVersion('>=2.0.0', nativeContext({ appVersion: null }))).toBe(false);
    expect(matchesBannerVersion('>=2.0.0', nativeContext({ appVersion: 'dev' }))).toBe(false);
  });
});

describe('normalizeBannerPage', () => {
  it('canonicalises the forms an admin might type', () => {
    expect(normalizeBannerPage('savings')).toBe('/savings');
    expect(normalizeBannerPage('/savings')).toBe('/savings');
    expect(normalizeBannerPage('/savings/')).toBe('/savings');
    expect(normalizeBannerPage(' /Savings ')).toBe('/savings');
    expect(normalizeBannerPage('/')).toBe('/');
    expect(normalizeBannerPage('')).toBe('');
  });
});

describe('matchesBannerPage', () => {
  it('shows banners with no page on every page', () => {
    expect(matchesBannerPage(undefined, '/')).toBe(true);
    expect(matchesBannerPage(undefined, '/savings')).toBe(true);
    expect(matchesBannerPage('', '/card/details')).toBe(true);
  });

  it('treats "/" as the home page only', () => {
    expect(matchesBannerPage('/', '/')).toBe(true);
    expect(matchesBannerPage('/', '/savings')).toBe(false);
  });

  it('accepts a page with or without its leading slash', () => {
    expect(matchesBannerPage('savings', '/savings')).toBe(true);
    expect(matchesBannerPage('/savings', '/savings')).toBe(true);
    expect(matchesBannerPage('/savings', '/savings/')).toBe(true);
    expect(matchesBannerPage('/savings', '/earn')).toBe(false);
  });

  it('does not treat a page as a prefix of its subroutes', () => {
    expect(matchesBannerPage('/card', '/card/details')).toBe(false);
    expect(matchesBannerPage('/card/details', '/card/details')).toBe(true);
  });

  it('falls back to the home page for an empty pathname', () => {
    expect(matchesBannerPage('/', '')).toBe(true);
  });
});

describe('matchesBannerPlatform', () => {
  it('shows banners that predate the platforms field', () => {
    expect(matchesBannerPlatform(undefined, 'ios')).toBe(true);
  });

  it('honours the per-platform toggles', () => {
    expect(matchesBannerPlatform({ web: true, ios: false, android: true }, 'ios')).toBe(false);
    expect(matchesBannerPlatform({ web: true, ios: false, android: true }, 'android')).toBe(true);
  });
});

describe('filterPromotionsBanners', () => {
  it('applies platform, version and page together, in sort order', () => {
    const banners = [
      banner({ slug: 'everywhere', sort: 2 }),
      banner({ slug: 'new-app-home', sort: 1, version: '>=2.0.0', page: '/' }),
      banner({ slug: 'savings-only', sort: 0, page: '/savings' }),
      banner({ slug: 'old-app-only', sort: 3, version: '1.0.12' }),
      banner({
        slug: 'android-only',
        sort: 4,
        platforms: { web: true, ios: false, android: true },
      }),
    ];

    const visible = filterPromotionsBanners(banners, nativeContext()).map(item => item.slug);

    expect(visible).toEqual(['new-app-home', 'everywhere']);
  });

  it('narrows to the banners scoped to the current page', () => {
    const banners = [
      banner({ slug: 'everywhere', sort: 1 }),
      banner({ slug: 'savings-only', sort: 0, page: 'savings' }),
    ];

    const visible = filterPromotionsBanners(banners, nativeContext({ pathname: '/savings' })).map(
      item => item.slug,
    );

    expect(visible).toEqual(['savings-only', 'everywhere']);
  });

  it('returns an empty list when there is nothing to show', () => {
    expect(filterPromotionsBanners(undefined, nativeContext())).toEqual([]);
    expect(filterPromotionsBanners([banner({ version: '>=3.0.0' })], nativeContext())).toEqual([]);
  });

  it('does not mutate the banners it was given', () => {
    const banners = [banner({ slug: 'b', sort: 1 }), banner({ slug: 'a', sort: 0 })];

    filterPromotionsBanners(banners, nativeContext());

    expect(banners.map(item => item.slug)).toEqual(['b', 'a']);
  });
});
