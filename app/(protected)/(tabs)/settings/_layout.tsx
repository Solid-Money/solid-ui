import { TouchableOpacity } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

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
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="email"
        options={{
          title: 'Email',
          headerBackButtonDisplayMode: 'minimal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="help"
        options={{
          title: 'Help & Support',
          headerBackButtonDisplayMode: 'minimal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="security"
        options={{
          title: 'Security',
          headerBackButtonDisplayMode: 'minimal',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
