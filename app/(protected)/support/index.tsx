import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useIsSidebarShell } from '@/components/Navbar/Sidebar';
import PageLayout from '@/components/PageLayout';
import SupportChat from '@/components/Support/SupportChat';
import SupportChatHeader from '@/components/Support/SupportChatHeader';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import { useSupportChatAvailability } from '@/hooks/useSupportChat';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

/**
 * The in-house support chat (replaces Intercom's messenger for users with the
 * `supportChat` feature). The route can be reached directly (a link, or a push
 * notification), so it checks the feature itself: anyone without it goes home
 * and gets the support sheet, which opens Intercom for them.
 */
export default function SupportScreen() {
  const availability = useSupportChatAvailability();
  if (availability === 'on') return <SupportChatPage />;
  return <NotAvailable loading={availability === 'loading'} />;
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
  useEffect(() => {
    if (loading) return;
    router.replace(path.HOME);
    openSupportDrawer();
  }, [loading, router]);
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator color="#FFFFFF" />
    </View>
  );
}
