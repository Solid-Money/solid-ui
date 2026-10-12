import { Stack } from 'expo-router';

import PasskeySupportGate from '@/components/PasskeySupportGate';

export default function SignupLayout() {
  return (
    <PasskeySupportGate>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
          contentStyle: {
            backgroundColor: '#0F0F10',
          },
        }}
      >
        <Stack.Screen name="email" />
        <Stack.Screen name="otp" />
        <Stack.Screen name="username" />
        <Stack.Screen name="creating" />
        <Stack.Screen name="passkey" />
      </Stack>
    </PasskeySupportGate>
  );
}
