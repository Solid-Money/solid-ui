import { Stack } from 'expo-router';

export default function CardLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#121212' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="ready" />
      <Stack.Screen name="pending" />
      <Stack.Screen name="activate" />
      {/* Fade (not slide) so the card view-transition from the wallet reads as a
          continuous move rather than fighting a horizontal push. */}
      <Stack.Screen name="details" options={{ animation: 'fade' }} />
    </Stack>
  );
}
