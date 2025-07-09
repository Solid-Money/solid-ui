import { Href } from "expo-router";
import { useMemo } from "react";

import { path } from "@/constants/path";
import useUser from "@/hooks/useUser";

type MenuItem = {
  label: string;
  href: Href;
}

const home: MenuItem = {
  label: "Home",
  href: path.HOME,
}

const wallet: MenuItem = {
  label: "Wallet",
  href: path.WALLET,
}

const defaultMenuItems: MenuItem[] = []

const useNav = () => {
  const { user } = useUser();
  const hasDeposited = user?.isDeposited;

  const menuItems = useMemo<MenuItem[]>(() => {
    const coreMenuItems = [home];
    if (hasDeposited) {
      coreMenuItems.push(wallet);
    }
    return [...coreMenuItems, ...defaultMenuItems];
  }, [hasDeposited]);

  return {
    menuItems,
    hasDeposited,
  };
}

export default useNav;
