import { Pressable, View } from 'react-native';

import HeaderSupportIcon from '@/assets/images/header-support';
import { useSupportUnread } from '@/hooks/useSupportChat';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

/**
 * Circular support button in the top-right of the mobile header (Figma
 * 24766:1840). It took over the slot the Activity bell used to hold — Activity
 * is now reached from the wallet's own "Recent activity → See all".
 * Styling matches HeaderProfileButton on the left.
 */
const HeaderSupportButton = () => {
  // Replies waiting in the in-house chat (always 0 for users still on Intercom).
  const unread = useSupportUnread();
  return (
    <Pressable
      accessibilityLabel={
        unread > 0
          ? `Get support, ${unread} unread ${unread === 1 ? 'reply' : 'replies'}`
          : 'Get support'
      }
      accessibilityRole="button"
      onPress={() => openSupportDrawer()}
      className="-my-[3px] h-[50px] w-[50px] items-center justify-center rounded-full bg-[#2A2A2A] transition-all active:scale-95 active:opacity-80 web:hover:bg-secondary-hover"
    >
      <HeaderSupportIcon />
      {unread > 0 && (
        <View
          testID="support-unread-dot"
          className="absolute right-[11px] top-[11px] h-2.5 w-2.5 rounded-full border-2 border-[#2A2A2A] bg-brand"
        />
      )}
    </Pressable>
  );
};

export default HeaderSupportButton;
