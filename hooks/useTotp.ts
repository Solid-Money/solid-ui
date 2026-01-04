import { useQuery } from '@tanstack/react-query';

import { getTotpStatus } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

export const useTotp = () => {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['totp-status'],
    queryFn: () => withRefreshToken(() => getTotpStatus()),
  });

  return {
    isVerified: data?.verified ?? false,
    isLoading,
    refetch,
  };
};
