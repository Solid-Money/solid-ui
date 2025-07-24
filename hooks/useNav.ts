import { Href } from "expo-router";
import { useMemo } from "react";

import { path } from "@/constants/path";
import { useWalletTokens } from "./useWalletTokens";

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
  const { hasTokens } = useWalletTokens();

  const menuItems = useMemo<MenuItem[]>(() => {
    if (hasTokens) {
      return [home, wallet];
    }
    return [];
  }, [hasTokens]);

  return {
    menuItems,
  };
}

export default useNav;
