import type { FuseSkipLine } from '@/lib/types';

/**
 * Whether the "Skip the line" section has anything to show.
 *
 * Three separate things can each mean "no section": an older backend that
 * doesn't send the block at all, the admin kill-switch being off, and a config
 * with no rungs priced. All of them collapse to the same outcome, so the check
 * lives here rather than being re-derived at each call site.
 */
export const hasSkipTheLine = (skipLine?: FuseSkipLine): skipLine is FuseSkipLine =>
  Boolean(skipLine?.enabled && skipLine.tiers.length > 0);
