import { View } from 'react-native';

import { useIsSidebarShell } from '@/components/Navbar/Sidebar';
import PageLayout from '@/components/PageLayout';
import SupportChat from '@/components/Support/SupportChat';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';

const ChatHeader = () => (
  <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
    <BackButton variant="header" fallbackHref="/" />
    <View className="flex-1">
      <Text className="text-lg font-semibold text-white">Support</Text>
      <Text className="text-xs text-white/50">Solid AI and the Solid team</Text>
    </View>
  </View>
);

/** The in-house support chat (replaces Intercom's messenger for users with the `supportChat` feature). */
export default function SupportScreen() {
  const { isScreenMedium } = useDimension();
  // The sidebar shell (desktop web) already shows `customMobileHeader` above the page.
  const isSidebarShell = useIsSidebarShell();
  return (
    <PageLayout
      scrollable={false}
      customMobileHeader={<ChatHeader />}
      edges={['left', 'right', 'top']}
    >
      <View className="mx-auto w-full max-w-2xl flex-1">
        {isScreenMedium && !isSidebarShell && <ChatHeader />}
        <SupportChat />
      </View>
    </PageLayout>
  );
}
