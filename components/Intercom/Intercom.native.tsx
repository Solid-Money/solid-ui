import { useEffect, useRef } from 'react';
import Intercom from '@intercom/intercom-react-native';

import { User } from '@/lib/types';
import { useUserStore } from '@/store/useUserStore';

type IntercomProps = {
  children: React.ReactNode;
};

/**
 * Native Intercom provider.
 * - Hides the default Intercom launcher (FAB)
 * - Auto-identifies/de-identifies users based on auth state
 */
const IntercomNative = ({ children }: IntercomProps) => {
  const hasInitialized = useRef(false);
  const lastIdentifiedUserId = useRef<string | null>(null);

  // Select the currently authenticated user from the store
  const user = useUserStore(state => state.users.find((u: User) => u.selected));

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Hide the default Intercom floating action button
    Intercom.setLauncherVisibility('GONE');
  }, []);

  // Auto-identify / de-identify users in Intercom
  useEffect(() => {
    if (user?.userId && user.userId !== lastIdentifiedUserId.current) {
      // Login with userId/email first, then update with name
      Intercom.loginUserWithUserAttributes({
        userId: user.userId,
        email: user.email,
      })
        .then(() => {
          if (user.username) {
            Intercom.updateUser({ name: user.username });
          }
        })
        .catch((err: unknown) => {
          console.error('[Intercom] Failed to identify user:', err);
        });
      lastIdentifiedUserId.current = user.userId;
    } else if (!user?.userId && lastIdentifiedUserId.current) {
      // User logged out
      Intercom.logout();
      lastIdentifiedUserId.current = null;
    }
  }, [user?.userId, user?.email, user?.username]);

  return <>{children}</>;
};

export default IntercomNative;
