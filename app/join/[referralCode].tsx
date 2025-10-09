import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useReferralStore } from '@/store/useReferralStore';

export default function JoinWithReferralCode() {
  const router = useRouter();
  const { referralCode } = useLocalSearchParams<{ referralCode: string }>();
  const { setReferralCode } = useReferralStore();

  useEffect(() => {
    if (referralCode && typeof referralCode === 'string') {
      // Save the referral code to storage
      setReferralCode(referralCode.trim());

      // Redirect to register page
      router.replace(path.REGISTER);
    } else {
      // If no referral code, just go to register
      router.replace(path.REGISTER);
    }
  }, [referralCode, setReferralCode, router]);

  return (
    <View className="flex-1 bg-background items-center justify-center">
      <ActivityIndicator size="large" color="white" />
      <Text className="text-white mt-4">Loading...</Text>
    </View>
  );
}
