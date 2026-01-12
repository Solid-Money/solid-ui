import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { TouchableOpacity } from 'react-native';

export default function ActivityLayout() {
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
        contentStyle: { flex: 1, backgroundColor: '#000' },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, freezeOnBlur: true }} />
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
