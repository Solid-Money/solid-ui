import React, { lazy, ReactNode, Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';

// Lazy load the ThirdwebProvider - this defers loading the thirdweb bundle
// until it's actually needed (when wallet/deposit features are used)
const ThirdwebProvider = lazy(() =>
  import('thirdweb/react').then(module => ({
    default: module.ThirdwebProvider,
  })),
);

interface LazyThirdwebProviderProps {
  children: ReactNode;
}

// Minimal loading fallback
const LoadingFallback = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" color="#cccccc" />
  </View>
);

/**
 * Lazy-loaded ThirdwebProvider wrapper
 *
 * This component defers loading the heavy thirdweb bundle until
 * it's actually rendered. For routes that don't need wallet functionality,
 * this saves significant memory and startup time.
 *
 * Usage:
 * - Wrap only the routes/components that need thirdweb functionality
 * - Don't wrap the entire app at root level
 */
export const LazyThirdwebProvider = ({ children }: LazyThirdwebProviderProps) => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ThirdwebProvider>{children}</ThirdwebProvider>
    </Suspense>
  );
};

export default LazyThirdwebProvider;
