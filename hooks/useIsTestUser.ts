import useUser from '@/hooks/useUser';
import { isUserAllowedToUseTestFeature } from '@/lib/utils/testFeatures';

export const useIsTestUser = (): boolean => {
  const { user } = useUser();
  return isUserAllowedToUseTestFeature(user?.username ?? '');
};
