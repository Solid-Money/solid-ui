import { TouchableOpacity } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ActivityLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#121212',
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
        contentStyle: { flex: 1, backgroundColor: '#121212' },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="[clientTxId]"
        options={{
          title: 'Activity Details',
          headerBackButtonDisplayMode: 'minimal',
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}
