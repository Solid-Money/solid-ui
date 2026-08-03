import { useEffect } from 'react';

interface NotificationPermissionSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

/** Notification permission onboarding is only shown in the native signup flow. */
export default function NotificationPermissionSheet({
  visible,
  onDismiss,
}: NotificationPermissionSheetProps) {
  useEffect(() => {
    if (visible) onDismiss();
  }, [onDismiss, visible]);

  return null;
}
