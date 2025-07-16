import { ImageSourcePropType } from "react-native";
import { fuse, mainnet } from "viem/chains";

import { ADDRESSES } from "@/lib/config";
import { TokenMap } from "@/lib/types";

export const TOKEN_MAP: TokenMap = {
  [mainnet.id]: [
    {
      name: "USDC",
      address: ADDRESSES.ethereum.usdc,
      symbol: "USDC",
      decimals: 6,
      imageId: "usdc",
    }
  ],
}

export const NATIVE_TOKENS: Record<number, string> = {
  [mainnet.id]: "ETH",
  [fuse.id]: "fuse-network-token",
}

export const TOKEN_IMAGES: Record<string, ImageSourcePropType> = {
  usdc: require("@/assets/images/usdc.png"),
  weth: require("@/assets/images/eth.png"),
  usdt: require("@/assets/images/usdt.png"),
  usds: require("@/assets/images/usds.png"),
}
