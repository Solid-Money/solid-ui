import * as React from 'react';
import { Pressable, type PressableProps, View } from 'react-native';

import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';

interface NavigationMenuProps {
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

interface NavigationMenuItemProps {
  value: string;
  children: React.ReactNode;
}

interface NavigationMenuLinkProps extends PressableProps {
  onPress?: () => void;
  className?: string;
  active?: boolean;
  children: React.ReactNode;
}

const NavigationMenu = React.forwardRef<View, NavigationMenuProps>(
  ({ className, children }, ref) => {
    return (
      <View ref={ref} className={cn('relative', className)}>
        {children}
      </View>
    );
  },
);
NavigationMenu.displayName = 'NavigationMenu';

const NavigationMenuList = React.forwardRef<View, { children: React.ReactNode }>(
  ({ children }, ref) => {
    return (
      <View ref={ref} className="flex flex-row items-center gap-1">
        {children}
      </View>
    );
  },
);
NavigationMenuList.displayName = 'NavigationMenuList';

const NavigationMenuItem = React.forwardRef<View, NavigationMenuItemProps>(({ children }, ref) => {
  return (
    <View ref={ref} className="relative">
      {children}
    </View>
  );
});
NavigationMenuItem.displayName = 'NavigationMenuItem';

const navigationMenuLinkClassNames = {
  pressable:
    'group inline-flex h-8 w-max items-center justify-center rounded-full px-3 py-2 md:p-5 transition-colors hover:bg-[#2C2C2C] focus:bg-[#2C2C2C] focus:outline-none disabled:pointer-events-none disabled:opacity-50',
  text: 'font-semibold',
};

const NavigationMenuLink = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  NavigationMenuLinkProps
>(({ onPress, className, active, children }, ref) => {
  const pressableClass = cn(navigationMenuLinkClassNames.pressable, active && 'bg-[#2C2C2C]');

  const textClass = cn(
    navigationMenuLinkClassNames.text,
    // active && "text-primary-foreground"
  );

  return (
    <TextClassContext.Provider value={textClass}>
      <Pressable ref={ref} onPress={onPress} className={cn(pressableClass, textClass, className)}>
        {children}
      </Pressable>
    </TextClassContext.Provider>
  );
});
NavigationMenuLink.displayName = 'NavigationMenuLink';

const navigationMenuTriggerStyle = () => {
  return cn(navigationMenuLinkClassNames.pressable, navigationMenuLinkClassNames.text);
};

export {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
};
