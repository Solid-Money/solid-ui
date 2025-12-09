import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createKycLink, getCustomerFromBridge, getKycLink, getKycLinkFromBridge } from '@/lib/api';
import { KycLinkFromBridgeResponse } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { isFinalKycStatus } from '@/lib/utils/kyc';

const CUSTOMER = 'customer';

export const useCustomer = () => {
  return useQuery({
    queryKey: [CUSTOMER],
    queryFn: () => withRefreshToken(() => getCustomerFromBridge()),
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

export const useKycLinkFromBridge = (kycLinkId?: string) => {
  return useQuery<KycLinkFromBridgeResponse | undefined>({
    queryKey: [CUSTOMER, 'kycLinkFromBridge', kycLinkId],
    queryFn: () => withRefreshToken(() => getKycLinkFromBridge(kycLinkId!)),
    enabled: !!kycLinkId,
    retry: false,
    refetchInterval: (query: any) => {
      if (!kycLinkId) return false;

      // In our TanStack version, refetchInterval receives the Query instance
      const data = query?.state?.data as any;
      const status = data?.kyc_status as string | undefined;
      const hasData = Boolean(data);
      // Poll every 5s while KYC is in a non-final state; stop when final
      const next = !hasData ? 5000 : isFinalKycStatus(status) ? false : 5000;

      try {
        console.log('[KYC Poll] tick', {
          kycLinkId,
          status,
          next,
          ts: new Date().toISOString(),
          qState: query?.state?.status,
        });
      } catch {}

      return next as any;
    },
    refetchIntervalInBackground: true,
  });
};

export const useCreateKycLink = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fullName,
      email,
      redirectUri,
      endorsements,
    }: {
      fullName: string;
      email: string;
      redirectUri: string;
      endorsements: string[];
    }) => {
      const result = await withRefreshToken(() =>
        createKycLink(fullName, email, redirectUri, endorsements),
      );
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
