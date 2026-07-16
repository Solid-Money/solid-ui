import useUser from '@/hooks/useUser';
import { isGoodDollarWhitelisted } from '@/lib/gooddollarAccess';

/**
 * Whether the current user may see the GoodDollar entry in the account center.
 *
 * GoodDollar is internal-only for now: only whitelisted internal team members
 * (by email) see it; it is hidden from all other public users.
 */
const useGoodDollarAccess = (): boolean => {
  const { user } = useUser();
  return isGoodDollarWhitelisted(user?.email);
};

export default useGoodDollarAccess;
