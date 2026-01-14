import { View } from 'react-native';
import { Link } from 'expo-router';

import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';

const ReferralTitle = () => {
  return (
    <View className="gap-3">
      <Text className="text-3xl font-semibold">Share your referral code</Text>
      <Text className="max-w-lg">
        <Text className="opacity-70">Earn points by depositing and referring friends.</Text>{' '}
        <Link href={path.REFERRAL} className="font-medium text-primary underline hover:opacity-70">
          Learn more
        </Link>
      </Text>
    </View>
  );
};

export default ReferralTitle;
