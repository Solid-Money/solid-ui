import { Stack } from 'expo-router';

export default function CardLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0F0F10' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="ready" />
      <Stack.Screen name="pending" />
      <Stack.Screen name="activate" />
      {/* No screen animation: the card hero overlay is the only motion, so the
          details screen swaps in instantly (opaque) while the card flies to it,
          instead of a fade competing with the transition. */}
      <Stack.Screen name="details" options={{ animation: 'none' }} />
    </Stack>
  );
}
