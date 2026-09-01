import { useWirexBankOverview } from '@/hooks/useWirexBankAccounts';

/**
 * Which provider issues this user's virtual bank account.
 *
 * `rain` is the original USD ACH/Wire account (Didit KYC); `wirex` is the
 * EUR SEPA / USD ACH pair (Sumsub KYC). Which one applies is decided at KYC
 * time by the user's jurisdiction and is not something the client chooses — it
 * simply asks.
 *
 * `loading` matters: routing to Rain while the answer is in flight would show a
 * Wirex user the Rain "apply" pitch for a product they cannot have.
 */
export type VirtualAccountProvider = 'wirex' | 'rain' | 'loading';

/**
 * Resolve the provider from the Wirex overview.
 *
 * The overview endpoint answers `isWirexUser: false` for everyone else without
 * calling Wirex at all, so this costs one cheap request and needs no separate
 * discriminator.
 */
export function useVirtualAccountProvider(enabled = true): {
  provider: VirtualAccountProvider;
  isLoading: boolean;
} {
  const { data, isLoading, isError } = useWirexBankOverview(enabled);

  // A failed lookup falls back to Rain rather than blocking: Rain is the
  // established path, and its own screens re-check eligibility anyway.
  if (isLoading && !isError) return { provider: 'loading', isLoading: true };

  return {
    provider: data?.isWirexUser ? 'wirex' : 'rain',
    isLoading: false,
  };
}
