import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchAddressBook } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { ContactNames } from '@/lib/utils/transferPresentation';

/**
 * The user's saved contacts by lowercased address, for naming the other side of a transfer.
 *
 * Reads the same `['address-book']` query `useAddressBook` does, so a feed and the send flow share
 * one request and one cache. `enabled` lets a row that is not a transfer stay out of it entirely.
 */
export const useContactNames = (options?: { enabled?: boolean }): ContactNames => {
  const { data: addressBook } = useQuery({
    queryKey: ['address-book'],
    queryFn: () => withRefreshToken(() => fetchAddressBook()),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });

  return useMemo(() => {
    const names = new Map<string, string>();
    for (const entry of addressBook ?? []) {
      const name = entry.name?.trim();
      if (name && entry.walletAddress) names.set(entry.walletAddress.toLowerCase(), name);
    }
    return names;
  }, [addressBook]);
};
