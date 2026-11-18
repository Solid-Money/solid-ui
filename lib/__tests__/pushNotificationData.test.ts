import { pushNotificationData } from '@/lib/pushNotificationData';

import type { NotificationRequest } from 'expo-notifications';

/**
 * expo-notifications reads a push differently on each platform. Android puts
 * FCM's `data` on `content.data`; iOS leaves that null for a push FCM sent and
 * hands over the raw APNs `userInfo` on `trigger.payload` instead, which is
 * where this has to find the same keys.
 */
const request = (
  content: Record<string, unknown> | null,
  trigger: unknown = null,
): NotificationRequest =>
  ({ identifier: 'n1', content: { data: content }, trigger }) as unknown as NotificationRequest;

/** What APNs delivers for a backend card-spend push sent through FCM. */
const iosUserInfo = {
  aps: {
    alert: { title: 'Paid $10 at Cafe' },
    sound: 'default',
    'mutable-content': 1,
  },
  fcm_options: { image: 'https://cdn.example.com/solid-push-notification.png' },
  'gcm.message_id': '1761234567890123',
  'google.c.a.e': '1',
  'google.c.fid': 'fid',
  'google.c.sender.id': '123456789',
  type: 'card-transaction',
  status: 'approved',
  transactionId: 'tx_1',
  utm_source: 'card_approved',
  utm_medium: 'push',
  utm_campaign: 'solid_transactional',
};

describe('pushNotificationData', () => {
  it('reads an iOS push from the APNs payload, without the APNs and Firebase entries', () => {
    expect(pushNotificationData(request(null, { type: 'push', payload: iosUserInfo }))).toEqual({
      type: 'card-transaction',
      status: 'approved',
      transactionId: 'tx_1',
      utm_source: 'card_approved',
      utm_medium: 'push',
      utm_campaign: 'solid_transactional',
    });
  });

  it('reads an Android push from content.data', () => {
    const data = { type: 'kyc-approved', link: 'https://app.solid.xyz/card' };

    expect(pushNotificationData(request(data, { type: 'push', remoteMessage: {} }))).toEqual(data);
  });

  it('prefers content.data when it is filled, as for a push from Expo’s service', () => {
    const data = { type: 'support_message' };

    expect(
      pushNotificationData(
        request(data, { type: 'push', payload: { ...iosUserInfo, body: data } }),
      ),
    ).toEqual(data);
  });

  it('falls back to the payload when content.data is an empty object', () => {
    expect(
      pushNotificationData(request({}, { type: 'push', payload: { type: 'support_message' } })),
    ).toEqual({ type: 'support_message' });
  });

  it('returns nothing for a push that carried no data of ours', () => {
    expect(
      pushNotificationData(
        request(null, { type: 'push', payload: { aps: {}, 'gcm.message_id': '1' } }),
      ),
    ).toBeUndefined();
  });

  it('does not read a payload off a trigger that is not a push', () => {
    expect(
      pushNotificationData(request(null, { type: 'timeInterval', payload: { type: 'x' } })),
    ).toBeUndefined();
    expect(pushNotificationData(request(null, null))).toBeUndefined();
  });
});
