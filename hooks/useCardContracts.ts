import { useQuery } from '@tanstack/react-query';

import { getCardContracts } from '@/lib/api';
import { CardProvider } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

import { useCardProvider } from './useCardProvider';

const CARD_CONTRACTS_KEY = 'cardContracts';

export function useCardContracts() {
  const { provider } = useCardProvider();

  return useQuery({
    queryKey: [CARD_CONTRACTS_KEY],
    queryFn: () => withRefreshToken(() => getCardContracts()),
    enabled: provider === CardProvider.RAIN,
    retry: false,
  });
}
