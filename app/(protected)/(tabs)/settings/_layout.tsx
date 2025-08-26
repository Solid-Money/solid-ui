import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { Platform, TouchableOpacity } from 'react-native';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#000000',
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
        name="account"
        options={{
          title: 'Account details',
          headerBackButtonDisplayMode: 'minimal',
          headerShown: Platform.OS !== 'web',
        }}
      />
      <Stack.Screen
        name="email"
        options={{
          title: 'Email',
          headerBackButtonDisplayMode: 'minimal',
          headerShown: Platform.OS !== 'web',
        }}
      />
      <Stack.Screen
        name="help"
        options={{
          title: 'Help & Support',
          headerBackButtonDisplayMode: 'minimal',
          headerShown: Platform.OS !== 'web',
        }}
      />
    </Stack>
  );
}
