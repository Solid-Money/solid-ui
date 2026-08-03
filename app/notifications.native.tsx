import { Redirect } from 'expo-router';

import { path } from '@/constants/path';
import { useOnboardingStore } from '@/store/useOnboardingStore';

/**
 * Notification onboarding now lives over the real wallet screen. Keep this
 * route as a compatibility entry point for signup and existing deep links.
 */
export default function Notifications() {
  const hasSeenNotificationOnboarding = useOnboardingStore(
    state => state.hasSeenNotificationOnboarding,
  );

  if (hasSeenNotificationOnboarding) {
    return <Redirect href={path.HOME} />;
  }

  return (
    <Redirect
      href={{
        pathname: '/',
        params: { notificationPermission: 'open' },
      }}
    />
  );
}
