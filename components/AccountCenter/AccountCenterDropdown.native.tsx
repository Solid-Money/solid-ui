import { View } from 'react-native';
import { router } from 'expo-router';

import { path } from '@/constants/path';

import { AccountCenterTrigger } from '.';

const AccountCenterDropdown = () => {
  return (
    <View>
      <AccountCenterTrigger
        accessibilityLabel="Open account center"
        accessibilityRole="button"
        onPress={() => router.push(path.SETTINGS)}
      />
    </View>
  );
};

export default AccountCenterDropdown;
