import { useCallback, useState } from 'react';
import Toast from 'react-native-toast-message';
import { useQueryClient } from '@tanstack/react-query';

import { Country } from '@/constants/countries';
import { WIREX_BANK_OVERVIEW_KEY } from '@/hooks/useWirexBankAccounts';
import { getWirexBankOverview } from '@/lib/api';
import { checkProductAccess } from '@/lib/countryAccess';
import { withRefreshToken } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';

/**
 * Record where the user says they live, and ask the server again which provider
 * opens their bank account there.
 *
 * Shared by every "Where do you live?" in the virtual-account flow — the Wirex
 * bank screen and the Rain account pitch — so the answer is stored the same way
 * wherever it was given, and the rest of the app (the cash list's EUR row, the
 * card's country) routes on it from then on.
 *
 * Resolves to the provider for that country, or null when the lookup failed
 * (already reported to the user).
 */
export const useConfirmResidence = () => {
  const queryClient = useQueryClient();
  const [isConfirming, setIsConfirming] = useState(false);

  const confirmResidence = useCallback(
    async (country: Country): Promise<'wirex' | 'rain' | null> => {
      const code = country.code.toUpperCase();
      setIsConfirming(true);
      try {
        // `isAvailable` in the store means the CARD to everyone who reads it, so
        // it is answered for the card, as the card's country screen does. An
        // unknown answer is not a no: a manual pick never goes stale, so a
        // stored `false` would hide the card in that country for good.
        const cardAccess = await checkProductAccess('card', code);
        if (cardAccess === null) throw new Error('Card access check failed');
        const routed = await queryClient.fetchQuery({
          queryKey: [WIREX_BANK_OVERVIEW_KEY, code],
          queryFn: () => withRefreshToken(() => getWirexBankOverview(code)),
        });
        // Stored only once routing has answered: a stored answer is what stops
        // the question being asked again, so a failed lookup must not leave
        // one behind.
        useCountryStore.getState().setCountryInfo({
          countryCode: code,
          countryName: country.name,
          isAvailable: cardAccess,
          source: 'manual',
        });
        return routed?.provider === 'wirex' ? 'wirex' : 'rain';
      } catch {
        Toast.show({
          type: 'error',
          text1: "Couldn't check your country",
          text2: 'Please try again in a moment.',
          props: { badgeText: '' },
        });
        return null;
      } finally {
        setIsConfirming(false);
      }
    },
    [queryClient],
  );

  return { confirmResidence, isConfirming };
};

export default useConfirmResidence;
