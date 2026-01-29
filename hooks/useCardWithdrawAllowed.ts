import useUser from '@/hooks/useUser';
import { isUserAllowedToUseTestFeature } from '@/lib/utils/testFeatures';

export const useCardWithdrawAllowed = (): boolean => {
  const { user } = useUser();
  return isUserAllowedToUseTestFeature(user?.username ?? '');
};
