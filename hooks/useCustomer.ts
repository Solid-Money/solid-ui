import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createKycLink, getCustomer, getKycLink } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

const CUSTOMER = 'customer';

export const useCustomer = () => {
  return useQuery({
    queryKey: [CUSTOMER],
    queryFn: () => withRefreshToken(() => getCustomer()),
    retry: false,
  });
};

export const useKycLink = (kycLinkId?: string) => {
  return useQuery({
    queryKey: [CUSTOMER, 'kycLink', kycLinkId],
    queryFn: () => withRefreshToken(() => getKycLink(kycLinkId!)),
    enabled: !!kycLinkId,
    retry: false,
  });
};

export const useCreateKycLink = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fullName,
      email,
      redirectUri,
    }: {
      fullName: string;
      email: string;
      redirectUri: string;
    }) => {
      const result = await withRefreshToken(() => createKycLink(fullName, email, redirectUri));
      if (!result) {
        throw new Error('Failed to create KYC link');
      }
      return result;
    },
    onSuccess: () => {
      // Invalidate customer query to refetch updated data
      queryClient.invalidateQueries({ queryKey: [CUSTOMER] });
    },
  });
};
