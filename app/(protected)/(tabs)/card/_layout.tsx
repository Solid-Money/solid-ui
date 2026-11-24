import { Stack } from 'expo-router';

export default function CardLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0F0F10' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="ready" />
      <Stack.Screen name="pending" />
      <Stack.Screen name="activate" />
      {/* Rain sunset: the move to the new card, emptying the closing one, and the
          card the sunset closed. */}
      <Stack.Screen name="new-card" />
      <Stack.Screen name="closing-withdraw" />
      <Stack.Screen name="closed" />
      <Stack.Screen name="credit" />
      <Stack.Screen name="credit/loan-safety" />
      {/* No screen animation: the card hero overlay plus the screen's own staggered
          entrance are the only motion, so the details screen swaps in instantly
          (opaque) while the card flies to it, instead of a fade competing with it. */}
      <Stack.Screen name="details" options={{ animation: 'none' }} />
    </Stack>
  );
}
