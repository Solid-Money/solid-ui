import { Href } from "expo-router";
import { useMemo } from "react";

import { path } from "@/constants/path";
import useUser from "./useUser";

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


const useNav = () => {
  const { user } = useUser();
  const hasDeposited = user?.isDeposited;

  const menuItems = useMemo<MenuItem[]>(() => {
    if (hasDeposited) {
      return [home, wallet];
    }
    return [];
  }, [hasDeposited]);

  return {
    menuItems,
  };
}

export default useNav;
