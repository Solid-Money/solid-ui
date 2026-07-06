import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createOnrampAutomation, getOnrampAutomation } from '@/lib/api';
import { OnrampAutomationRail } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

const ONRAMP_AUTOMATION_KEY = 'onrampAutomation';

export function useOnrampAutomation(enabled = true) {
  return useQuery({
    queryKey: [ONRAMP_AUTOMATION_KEY],
    queryFn: () => withRefreshToken(() => getOnrampAutomation()),
    enabled,
    retry: 1,
  });
}

export function useCreateOnrampAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rail: OnrampAutomationRail = 'ach') => {
      const data = await withRefreshToken(() => createOnrampAutomation(rail));
      if (!data) throw new Error('Failed to create onramp automation');
      return data;
    },
    onSuccess: data => {
      queryClient.setQueryData([ONRAMP_AUTOMATION_KEY], data);
    },
  });
}
