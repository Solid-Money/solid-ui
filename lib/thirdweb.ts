import { createThirdwebClient } from "thirdweb";
import { mainnet, polygon, base, arbitrum } from "thirdweb/chains";

import { EXPO_PUBLIC_THIRDWEB_CLIENT_ID } from "./config";

export const client = createThirdwebClient({
  clientId: EXPO_PUBLIC_THIRDWEB_CLIENT_ID
});

const chains = [
  mainnet,
  polygon,
  base,
  arbitrum,
]

export const getChain = (chainId: number) => {
  return chains.find((chain) => chain.id === chainId);
};
