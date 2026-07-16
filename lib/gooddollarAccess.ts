import { EXPO_PUBLIC_GOODDOLLAR_WHITELIST } from '@/lib/config';

/**
 * GoodDollar is an internal-only feature for now. The account center entry that
 * links to it is shown only to whitelisted internal team members and hidden
 * from all other (public) users.
 *
 * The whitelist is a comma-separated list of team member emails provided via
 * `EXPO_PUBLIC_GOODDOLLAR_WHITELIST`. When the env var is empty the whitelist is
 * empty, so GoodDollar stays hidden for everyone by default.
 */
export const GOODDOLLAR_WHITELIST: readonly string[] = EXPO_PUBLIC_GOODDOLLAR_WHITELIST.split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

export const isGoodDollarWhitelisted = (email?: string | null): boolean =>
  !!email && GOODDOLLAR_WHITELIST.includes(email.toLowerCase());
