import { Address, pad } from 'viem';
import { arbitrum, base, fuse, mainnet, polygon } from 'viem/chains';

import { StargateOFT_ABI } from '@/lib/abis/StargateOFT';
import { StargateQuoteParams, StargateQuoteResponse } from '@/lib/types';
import { publicClient } from '@/lib/wagmi';

export const getStargateChainId = (chainId: number) => {
  switch (chainId) {
    case mainnet.id:
      return 30101;
    case base.id:
      return 30184;
    case polygon.id:
      return 30109;
    case arbitrum.id:
      return 30110;
    default:
      return null;
  }
};

export const getStargateChainKey = (chainId: number) => {
  switch (chainId) {
    case mainnet.id:
      return 'ethereum';
    case base.id:
      return 'base';
    case polygon.id:
      return 'polygon';
    case arbitrum.id:
      return 'arbitrum';
    default:
      return null;
  }
};

export const getStargateToken = (chainId: number) => {
  switch (chainId) {
    case mainnet.id:
      return '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    case base.id:
      return '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    case polygon.id:
      return '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
    case arbitrum.id:
      return '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
    default:
      return null;
  }
};

// LayerZero Endpoint IDs for supported destination chains
const CHAIN_KEY_TO_EID: Record<string, number> = {
  ethereum: 30101,
  fuse: 30138,
  base: 30184,
  polygon: 30109,
  arbitrum: 30110,
};

// Direct on-chain quote via Stargate OFT contract (replaces deprecated Stargate API)
export const getStargateQuote = async (
  params: StargateQuoteParams,
): Promise<StargateQuoteResponse> => {
  const dstEid = CHAIN_KEY_TO_EID[params.dstChainKey];
  if (!dstEid) {
    throw new Error(`Unsupported destination chain: ${params.dstChainKey}`);
  }

  // On Fuse, USDC_STARGATE is the OFT contract that implements quoteSend
  const oftAddress = params.srcToken as Address;

  const sendParam = {
    dstEid,
    to: pad(params.dstAddress as Address, { size: 32 }),
    amountLD: BigInt(params.srcAmount),
    minAmountLD: BigInt(params.dstAmountMin),
    extraOptions: '0x' as `0x${string}`,
    composeMsg: '0x' as `0x${string}`,
    oftCmd: '0x' as `0x${string}`,
  };

  const client = publicClient(fuse.id);
  const { nativeFee } = await client.readContract({
    address: oftAddress,
    abi: StargateOFT_ABI,
    functionName: 'quoteSend',
    args: [sendParam, false],
  });

  return {
    quotes: [
      {
        route: 'stargate_v2_taxi',
        error: null,
        srcAmount: params.srcAmount,
        dstAmount: params.srcAmount,
        srcAmountMax: params.srcAmount,
        dstAmountMin: params.dstAmountMin,
        srcToken: params.srcToken,
        dstToken: params.dstToken,
        srcAddress: params.srcAddress,
        dstAddress: params.dstAddress,
        srcChainKey: params.srcChainKey,
        dstChainKey: params.dstChainKey,
        dstNativeAmount: '0',
        duration: { estimated: 60 },
        fees: [
          {
            token: '0x0000000000000000000000000000000000000000',
            chainKey: params.srcChainKey,
            amount: nativeFee.toString(),
            type: 'native',
          },
        ],
        steps: [
          {
            type: 'bridge',
            sender: params.srcAddress,
            chainKey: params.srcChainKey,
            transaction: {
              to: params.srcToken,
              value: nativeFee.toString(),
              data: '0x',
              from: params.srcAddress,
            },
          },
        ],
      },
    ],
  };
};
