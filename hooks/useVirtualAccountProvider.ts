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
 * The overview endpoint answers for everyone without calling Wirex at all when
 * the user has no Wirex account, so this costs one cheap request and needs no
 * separate discriminator.
 *
 * `provider` is the server's own routing answer, taken from the user's
 * KYC-verified country against Wirex's per-rail bank availability. It is NOT
 * `isWirexUser`, which was the old test and got this wrong for the case that
 * matters most: a user Wirex serves who has never verified reads
 * `isWirexUser: false`, and routing them to Rain showed them a pitch for a
 * product they should not be sold. That user now comes back as `wirex` with
 * `kycRequired`.
 */
export function useVirtualAccountProvider(enabled = true): {
  provider: VirtualAccountProvider;
  /** Wirex serves them, but they must verify with Sumsub before they get an account. */
  kycRequired: boolean;
  isLoading: boolean;
} {
  const { data, isLoading, isError } = useWirexBankOverview(enabled);

  // A failed lookup falls back to Rain rather than blocking: Rain is the
  // established path, and its own screens re-check eligibility anyway.
  if (isLoading && !isError) {
    return { provider: 'loading', kycRequired: false, isLoading: true };
  }

  return {
    // `?? (isWirexUser ? …)` covers a backend that predates the field, so a
    // version skew degrades to the old behaviour rather than to Rain for
    // everyone — including existing Wirex users mid-deploy.
    provider: data?.provider ?? (data?.isWirexUser ? 'wirex' : 'rain'),
    kycRequired: data?.kycRequired ?? false,
    isLoading: false,
  };
}
