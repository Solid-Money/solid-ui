import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { TouchableOpacity } from 'react-native';

export default function CardLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#262626',
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
        name="activate_mobile"
        options={{
          title: 'Solid card',
        }}
      />
      <Stack.Screen
        name="user_info_mobile"
        options={{
          title: 'Personal Information',
        }}
      />
    </Stack>
  );
}
