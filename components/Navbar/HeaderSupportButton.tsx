import { Pressable } from 'react-native';

import HeaderSupportIcon from '@/assets/images/header-support';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

/**
 * Circular support button in the top-right of the mobile header (Figma
 * 24766:1840). It took over the slot the Activity bell used to hold — Activity
 * is now reached from the wallet's own "Recent activity → See all".
 * Styling matches HeaderProfileButton on the left.
 */
const HeaderSupportButton = () => {
  return (
    <Pressable
      accessibilityLabel="Get support"
      accessibilityRole="button"
      onPress={() => openSupportDrawer()}
      className="-my-[3px] h-[50px] w-[50px] items-center justify-center rounded-full bg-[#2A2A2A] transition-all active:scale-95 active:opacity-80 web:hover:bg-secondary-hover"
    >
      <HeaderSupportIcon />
    </Pressable>
  );
};

export default HeaderSupportButton;
