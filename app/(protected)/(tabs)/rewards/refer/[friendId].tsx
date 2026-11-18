import { useLocalSearchParams } from 'expo-router';

import ReferFriendScreen from '@/components/Referral/v4/ReferFriendScreen';

export default function ReferFriend() {
  const { friendId } = useLocalSearchParams<{ friendId?: string }>();
  return <ReferFriendScreen friendId={friendId} />;
}
