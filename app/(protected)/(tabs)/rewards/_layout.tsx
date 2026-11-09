import { TouchableOpacity } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import TierStarPreloadProvider from '@/components/Rewards/NewRewards/TierHero/TierStarPreload';

export default function RewardsLayout() {
  return (
    <TierStarPreloadProvider>
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
        <Stack.Screen name="ai-api" options={{ headerShown: false }} />
        <Stack.Screen name="ai-api-key" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="ai-api-setup" options={{ headerShown: false }} />
        {/* Referral v4. Each screen sends the user back to today's referral
            popup while the program is off. */}
        <Stack.Screen name="refer/index" options={{ headerShown: false }} />
        <Stack.Screen name="refer/invites" options={{ headerShown: false }} />
        <Stack.Screen name="refer/[friendId]" options={{ headerShown: false }} />
      </Stack>
    </TierStarPreloadProvider>
  );
}
