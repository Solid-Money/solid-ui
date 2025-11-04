import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  AccountCenterSettings,
  AccountCenterSignOut,
  AccountCenterTrigger,
  AccountCenterUsername,
  onAccountCenterSettingsPress,
  useAccountCenterSignOutPress,
} from '.';

const dropdownMenuItemClassName = 'h-12 flex-row items-center gap-2 px-4 web:cursor-pointer';
const cursorDefaultClassName =
  'web:cursor-default web:hover:bg-transparent web:focus:bg-transparent active:bg-transparent';

const AccountCenterDropdown = () => {
  const insets = useSafeAreaInsets();
  const onAccountCenterSignOutPress = useAccountCenterSignOutPress();

  const contentInsets = {
    top: insets.top,
    bottom: insets.bottom,
    left: 12,
    right: 12,
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full">
        <AccountCenterTrigger />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        insets={contentInsets}
        align="end"
        className="w-52 mt-1 bg-card border-none rounded-3xl"
      >
        <DropdownMenuItem
          className={cn(dropdownMenuItemClassName, cursorDefaultClassName, 'rounded-t-3xl')}
        >
          <AccountCenterUsername />
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border/50" />
        <DropdownMenuItem
          className={cn(dropdownMenuItemClassName)}
          onPress={onAccountCenterSettingsPress}
        >
          <AccountCenterSettings />
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn(dropdownMenuItemClassName, 'rounded-b-3xl')}
          onPress={onAccountCenterSignOutPress}
        >
          <AccountCenterSignOut />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AccountCenterDropdown;
