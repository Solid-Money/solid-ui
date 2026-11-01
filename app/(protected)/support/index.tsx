import { useCallback, useEffect } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import { useIsSidebarShell } from '@/components/Navbar/Sidebar';
import PageLayout from '@/components/PageLayout';
import SupportChat from '@/components/Support/SupportChat';
import SupportChatHeader from '@/components/Support/SupportChatHeader';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import { useSupportChatAvailability } from '@/hooks/useSupportChat';
import { useSupportChatStore } from '@/store/useSupportChatStore';
import { openSupportDrawer, takeHeldSupportRequest } from '@/store/useSupportDrawerStore';

/**
 * The in-house support chat (replaces Intercom's messenger for users with the
 * `supportChat` feature). The route can be reached directly (a link, or a push
 * notification), so it checks the feature itself: anyone without it goes home
 * and gets the support sheet, which opens Intercom for them. If the check
 * itself fails, the screen says so and offers a retry rather than guessing.
 */
export default function SupportScreen() {
  const { availability, retry } = useSupportChatAvailability();

  // The chat took over: the held request was only for the Intercom fallback.
  useEffect(() => {
    if (availability === 'on') takeHeldSupportRequest();
  }, [availability]);

  // Leaving before the chat opened (a failed check, say) must not leave a
  // context card behind for a later, unrelated message. On web the screen stays
  // mounted under the next route, so this runs when it loses focus, not on unmount.
  useFocusEffect(
    useCallback(
      () => () => {
        useSupportChatStore.getState().setDraftContext(null);
        takeHeldSupportRequest();
      },
      [],
    ),
  );

  if (availability === 'on') return <SupportChatPage />;
  if (availability === 'error') return <CheckFailed onRetry={retry} />;
  return <NotAvailable loading={availability === 'loading'} />;
}

function CheckFailed({ onRetry }: { onRetry: () => void }) {
  const router = useRouter();
  // This route has no header, so the screen carries its own way out.
  const leave = () => (router.canGoBack() ? router.back() : router.replace(path.HOME));
  return (
    <View className="flex-1 items-center justify-center gap-3 px-6">
      <Text className="text-center text-white/70">
        We couldn&apos;t open the chat. Check your connection and try again.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        className="rounded-full bg-white/10 px-4 py-2 active:opacity-70"
      >
        <Text className="text-white">Try again</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={leave} className="px-4 py-2 active:opacity-70">
        <Text className="text-white/70">Back</Text>
      </Pressable>
    </View>
  );
}

function SupportChatPage() {
  const { isScreenMedium } = useDimension();
  // The sidebar shell (desktop web) already shows `customMobileHeader` above the page.
  const isSidebarShell = useIsSidebarShell();
  return (
    <PageLayout
      scrollable={false}
      customMobileHeader={<SupportChatHeader />}
      edges={['left', 'right', 'top']}
    >
      <View className="mx-auto w-full max-w-2xl flex-1">
        {isScreenMedium && !isSidebarShell && <SupportChatHeader />}
        <SupportChat />
      </View>
    </PageLayout>
  );
}

function NotAvailable({ loading }: { loading: boolean }) {
  const router = useRouter();
  // An answer that arrives after the user moved on must not pull them back home.
  // If they come back to /support later, it applies then (without the old request).
  const focused = useIsFocused();
  useEffect(() => {
    if (loading || !focused) return;
    // Whatever the button that sent the user here meant for Intercom. Taken
    // before leaving, because losing focus clears it.
    const request = takeHeldSupportRequest();
    router.replace(path.HOME);
    openSupportDrawer(request);
  }, [focused, loading, router]);
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator color="#FFFFFF" />
    </View>
  );
}
