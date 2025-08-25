import { fuse, mainnet } from "viem/chains"

import { Explorers } from "@/lib/types"

export const lifi = {
  id: -1,
  blockExplorers: {
    default: {
      name: "LIFI",
      url: "https://scan.li.fi",
    },
  },
}

export const layerzero = {
  id: 0,
  blockExplorers: {
    default: {
      name: "LayerZeroScan",
      url: "https://layerzeroscan.com",
    },
  },
}

export const explorerUrls: Record<number, Explorers> = {
  [lifi.id]: {
    lifiscan: lifi.blockExplorers?.default.url,
  },
  [layerzero.id]: {
    layerzeroscan: layerzero.blockExplorers?.default.url,
  },
  [mainnet.id]: {
    blockscout: "https://eth.blockscout.com",
    etherscan: mainnet.blockExplorers?.default.url,
  },
  [fuse.id]: {
    blockscout: fuse.blockExplorers?.default.url
  },
}
