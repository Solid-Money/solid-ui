import { useHasFeature } from '@/hooks/useFeatureAccess';
import { isDevFeatureEnabled } from '@/lib/config';

/**
 * Whether this user gets the redesigned swap: one form for every network,
 * asset-first pickers, a review sheet and a done screen. Everyone on qa and
 * preview builds; in production, only users on the feature whitelist (`swap`).
 * The rest keep the current form, as does a whitelisted user until the
 * whitelist answers.
 */
export function useNewSwapFlow(): boolean {
  const whitelisted = useHasFeature('swap');
  return isDevFeatureEnabled || whitelisted;
}
