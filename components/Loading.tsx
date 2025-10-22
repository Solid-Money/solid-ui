import { ActivityIndicator, View } from 'react-native';

export default function Loading() {
  return (
    <View className="bg-background flex-1 justify-center items-center h-full">
      <ActivityIndicator size="large" color="#cccccc" />
    </View>
  );
}
