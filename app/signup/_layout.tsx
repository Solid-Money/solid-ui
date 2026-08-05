import { Stack } from 'expo-router';

export default function SignupLayout() {
  return (
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
      <Stack.Screen name="creating" />
      <Stack.Screen name="passkey" />
    </Stack>
  );
}
