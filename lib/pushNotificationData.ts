import type { NotificationRequest, PushNotificationTrigger } from 'expo-notifications';

/**
 * Entries APNs and Firebase put in an iOS push's `userInfo` beside ours: the
 * `aps` dictionary, `fcm_options` (the image URL) and Firebase's `gcm.*` and
 * `google.*` bookkeeping. Our backend sent none of them.
 */
function isTransportKey(key: string): boolean {
  return (
    key === 'aps' || key === 'fcm_options' || key.startsWith('gcm.') || key.startsWith('google.')
  );
}

function isPushTrigger(
  trigger: NotificationRequest['trigger'],
): trigger is PushNotificationTrigger {
  return (
    typeof trigger === 'object' && trigger !== null && 'type' in trigger && trigger.type === 'push'
  );
}

/**
 * The `data` our backend put on a push, on either platform.
 *
 * Android hands it over as `content.data`. iOS does not: expo-notifications
 * fills `content.data` on a remote push from the payload's `body` key, which is
 * where Expo's own push service puts it, and leaves it null for a push sent
 * through FCM, which writes each data key at the top level of the APNs payload
 * instead. Those keys are on `trigger.payload`, the whole `userInfo`, next to
 * the APNs and Firebase entries this drops.
 *
 * Reading `content.data` alone is why every iOS tap opened home and every iOS
 * open reached Amplitude with no `notification_type`.
 */
export function pushNotificationData(
  request: NotificationRequest,
): Record<string, unknown> | undefined {
  const { data } = request.content;
  if (data && Object.keys(data).length > 0) return data;

  const { trigger } = request;
  if (!isPushTrigger(trigger) || !trigger.payload) return undefined;

  const ours = Object.fromEntries(
    Object.entries(trigger.payload).filter(([key]) => !isTransportKey(key)),
  );
  return Object.keys(ours).length > 0 ? ours : undefined;
}
