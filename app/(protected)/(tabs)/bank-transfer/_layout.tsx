import { TouchableOpacity } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function BankTransferLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#000',
        },
        headerTitleAlign: 'center',
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          color: '#ffffff',
          fontSize: 20,
          fontWeight: 'bold',
        },
        headerLeft: ({ tintColor }) =>
          router.canGoBack() ? (
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color={tintColor} />
            </TouchableOpacity>
          ) : null,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Amount to buy' }} />
      <Stack.Screen name="payment-method" options={{ title: 'Choose payment method' }} />
      <Stack.Screen name="preview" options={{ title: '' }} />
    </Stack>
  );
}
