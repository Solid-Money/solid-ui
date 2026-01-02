import { ActivityIndicator, View } from 'react-native';

export default function Loading() {
  return (
    <View className="h-full flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" color="#cccccc" />
    </View>
  );
}
