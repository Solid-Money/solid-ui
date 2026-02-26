import { TouchableOpacity } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SpinWinLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: '#101010',
        },
        headerTitleAlign: 'center',
        headerTintColor: '#FFD151',
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
        name="wheel"
        options={{
          title: 'Spin the Wheel',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <Stack.Screen
        name="result"
        options={{
          title: '',
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="summary"
        options={{
          title: 'Summary',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <Stack.Screen
        name="giveaway"
        options={{
          title: 'Giveaway',
          headerTransparent: true,
        }}
      />
    </Stack>
  );
}
