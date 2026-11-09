import Toast from 'react-native-toast-message';

import { ACCOUNT_SUSPENDED_MESSAGE, ACCOUNT_SUSPENDED_TITLE } from '@/lib/errors/accountSuspended';

/**
 * Tells someone whose session a suspension just ended why they were signed
 * out. Not "sign in again": an admin suspended the account, and signing in is
 * refused until support lifts it. Shown wherever the app lands them, so the
 * welcome screen and onboarding say the same thing.
 */
export const showAccountSuspendedToast = () =>
  Toast.show({
    type: 'error',
    text1: ACCOUNT_SUSPENDED_TITLE,
    text2: ACCOUNT_SUSPENDED_MESSAGE,
    visibilityTime: 10_000,
    props: {
      badgeText: '',
    },
  });
