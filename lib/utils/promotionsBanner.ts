import { PromotionsBannerItem, PromotionsBannerPlatforms } from '@/lib/types';

export type PromotionsBannerPlatformKey = keyof PromotionsBannerPlatforms;

/**
 * Targeting a banner is admin-driven, so everything here is a pure function of
 * the banner plus the device it is being rendered on. Callers pass the device
 * facts in (see `HomeBanners` / `HomePromoBanners`) rather than reading them
 * here, which keeps the rules testable without mocking expo modules.
 */
export type PromotionsBannerContext = {
  platform: PromotionsBannerPlatformKey;
  /**
   * `Application.nativeApplicationVersion`, i.e. the version in app.config.ts
   * baked into the installed build. Null on web and in dev clients that don't
   * expose it.
   */
  appVersion: string | null;
  /** Current route from `usePathname()`, e.g. '/' or '/savings'. */
  pathname: string;
};

type Comparator = '>=' | '<=' | '>' | '<' | '=';

const COMPARATOR_PATTERN = /^(>=|<=|>|<|=)?\s*(\d+(?:\.\d+){0,2})$/;

/**
 * Semver as a triple, padding the segments an admin left off: '2' and '2.0'
 * both mean 2.0.0. Native version strings are plain x.y.z (iOS
 * CFBundleShortVersionString / Android versionName), so there is no prerelease
 * or build metadata to weigh up.
 */
const parseVersion = (version: string): [number, number, number] | null => {
  const match = /^\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?\s*$/.exec(version);
  if (!match) return null;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
};

/** Negative when `a` is older than `b`, positive when newer, 0 when equal. */
const compareVersions = (a: [number, number, number], b: [number, number, number]): number =>
  a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

const satisfiesComparator = (comparison: number, comparator: Comparator | undefined): boolean => {
  switch (comparator) {
    case '>=':
      return comparison >= 0;
    case '>':
      return comparison > 0;
    case '<=':
      return comparison <= 0;
    case '<':
      return comparison < 0;
    // A bare version, with or without '=', pins the banner to that build only.
    default:
      return comparison === 0;
  }
};

/**
 * Does the installed app version satisfy a banner's version gate?
 *
 * A banner with no gate shows everywhere. Web always shows the banner because
 * every visitor is already on the newest build — there is no older version out
 * there to gate against. A gate we can't parse is treated as "don't show":
 * silently ignoring it would blast the banner at every user, which is the more
 * expensive way to be wrong.
 */
export const matchesBannerVersion = (
  bannerVersion: string | undefined,
  { platform, appVersion }: Pick<PromotionsBannerContext, 'platform' | 'appVersion'>,
): boolean => {
  const gate = bannerVersion?.trim();
  if (!gate) return true;
  if (platform === 'web') return true;

  const match = COMPARATOR_PATTERN.exec(gate);
  if (!match) return false;

  const target = parseVersion(match[2]);
  const installed = appVersion ? parseVersion(appVersion) : null;
  // No readable installed version (dev client, web fallback) means we can't
  // honour the gate, so leave the banner out.
  if (!target || !installed) return false;

  return satisfiesComparator(
    compareVersions(installed, target),
    match[1] as Comparator | undefined,
  );
};

/**
 * Normalise a pathname so the forms an admin and expo-router each produce
 * compare equal: 'savings', '/savings' and '/Savings/' are all '/savings'.
 */
export const normalizeBannerPage = (page: string): string => {
  const trimmed = page.trim().toLowerCase();
  if (!trimmed) return '';

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, '') : withLeadingSlash;
};

/**
 * Is the banner scoped to the page currently on screen? A banner with no page
 * shows on every page; '/' is the home/wallet page only, not a prefix of
 * everything below it.
 */
export const matchesBannerPage = (
  bannerPage: string | undefined,
  pathname: PromotionsBannerContext['pathname'],
): boolean => {
  const target = normalizeBannerPage(bannerPage ?? '');
  if (!target) return true;

  return normalizeBannerPage(pathname || '/') === target;
};

export const matchesBannerPlatform = (
  platforms: PromotionsBannerPlatforms | undefined,
  platform: PromotionsBannerPlatformKey,
): boolean => !platforms || platforms[platform] !== false;

/**
 * Banners this device and page should show, in the order the admin sorted them.
 */
export const filterPromotionsBanners = <T extends PromotionsBannerItem>(
  banners: T[] | undefined,
  context: PromotionsBannerContext,
): T[] =>
  (banners ?? [])
    .filter(
      banner =>
        matchesBannerPlatform(banner.platforms, context.platform) &&
        matchesBannerVersion(banner.version, context) &&
        matchesBannerPage(banner.page, context.pathname),
    )
    .sort((a, b) => a.sort - b.sort);
