import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  InfoCenterDocs,
  InfoCenterLegal,
  InfoCenterSupport,
  InfoCenterTrigger,
  onInfoCenterDocsPress,
  onInfoCenterLegalPress,
  useInfoCenterSupportPress,
} from '.';

const dropdownMenuItemClassName = 'h-12 flex-row items-center gap-2 px-4 web:cursor-pointer';

const InfoCenterDropdown = () => {
  const insets = useSafeAreaInsets();
  const onInfoCenterSupportPress = useInfoCenterSupportPress();

  const contentInsets = {
    top: insets.top,
    bottom: insets.bottom,
    left: 12,
    right: 12,
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <InfoCenterTrigger />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        insets={contentInsets}
        align="end"
        className="mt-1 w-44 rounded-3xl border-0 border-none bg-card"
      >
        <DropdownMenuItem
          className={cn(dropdownMenuItemClassName, 'rounded-t-3xl')}
          onPress={onInfoCenterSupportPress}
        >
          <InfoCenterSupport />
        </DropdownMenuItem>
        <DropdownMenuItem className={cn(dropdownMenuItemClassName)} onPress={onInfoCenterDocsPress}>
          <InfoCenterDocs />
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn(dropdownMenuItemClassName, 'rounded-b-3xl')}
          onPress={onInfoCenterLegalPress}
        >
          <InfoCenterLegal />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default InfoCenterDropdown;
