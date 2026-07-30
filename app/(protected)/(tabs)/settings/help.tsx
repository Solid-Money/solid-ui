import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import { openSupportDrawer } from '@/store/useSupportDrawerStore';

/**
 * Backwards-compatible route for existing links to `/settings/help`.
 * New entry points open the global drawer directly so the current screen
 * remains visible behind it.
 */
export default function Help() {
  useEffect(() => {
    openSupportDrawer();

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings');
    }
  }, []);

  return <View className="flex-1 bg-[#111111]" />;
}
