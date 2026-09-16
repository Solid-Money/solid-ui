import { TouchableOpacity } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function RewardsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0F0F10',
        },
        headerTitleAlign: 'center',
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          color: '#ffffff',
          fontSize: 20,
          fontWeight: 'bold',
        },
        headerLeft: ({ canGoBack, tintColor }) =>
          canGoBack ? (
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color={tintColor} />
            </TouchableOpacity>
          ) : null,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="benefits"
        options={{
          title: 'Rewards benefits',
          headerBackButtonDisplayMode: 'minimal',
          headerShown: false,
        }}
      />
      {/* Both upgrade screens draw their own header — back, title and a dismiss
          that leaves the flow rather than stepping back through it. */}
      <Stack.Screen name="upgrade" options={{ title: 'Upgrade tier', headerShown: false }} />
      <Stack.Screen name="upgrade-review" options={{ title: 'Upgrade tier', headerShown: false }} />
    </Stack>
  );
}
