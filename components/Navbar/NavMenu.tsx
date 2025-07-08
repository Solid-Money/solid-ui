import { useNavigation, usePathname, useRouter } from "expo-router";
import { useEffect, useState } from "react";

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { Text } from "@/components/ui/text";
import useNav from "@/hooks/useNav";

export function NavMenu() {
  const pathname = usePathname()
  const [value, setValue] = useState<string>();
  const navigation = useNavigation();
  const router = useRouter();
  const { menuItems } = useNav();

  function closeAll() {
    setValue('');
  }

  useEffect(() => {
    const sub = navigation.addListener('blur', () => {
      closeAll();
    });

    return sub;
  }, [navigation]);

  return (
    <NavigationMenu value={value} onValueChange={setValue}>
      <NavigationMenuList>
        {menuItems.map((item) => (
          <NavigationMenuItem key={item.label} value={item.label}>
            <NavigationMenuLink
              onPress={() => router.push(item.href)}
              active={pathname === item.href}
            >
              <Text>{item.label}</Text>
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  )
}
