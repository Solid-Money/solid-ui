import { ActivityIndicator, View } from 'react-native';

import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <PageLayout desktopOnly contentClassName="pb-10">
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#cccccc" />
        <Text className="mt-4 text-white/70">{message}</Text>
      </View>
    </PageLayout>
  );
}
