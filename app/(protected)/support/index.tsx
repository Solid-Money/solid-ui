import { View } from 'react-native';

import { useIsSidebarShell } from '@/components/Navbar/Sidebar';
import PageLayout from '@/components/PageLayout';
import SupportChat from '@/components/Support/SupportChat';
import SupportChatHeader from '@/components/Support/SupportChatHeader';
import { useDimension } from '@/hooks/useDimension';

/** The in-house support chat (replaces Intercom's messenger for users with the `supportChat` feature). */
export default function SupportScreen() {
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
