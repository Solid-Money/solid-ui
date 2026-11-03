import { zeroAddress } from 'viem';

import { USDC_STARGATE, USDT_STARGATE, WRAPPED_FUSE } from '@/constants/addresses';
import { solidBridgeRoute } from '@/constants/swapChains';
import { ADDRESSES } from '@/lib/config';

const FUSE = 122;
const BASE = 8453;
const ETHEREUM = 1;
const BNB = 56;
const ARBITRUM = 42161;

const usdcFuse = { chainId: FUSE, address: USDC_STARGATE };
const usdtFuse = { chainId: FUSE, address: USDT_STARGATE };
const usdcBase = { chainId: BASE, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' };
const usdcEthereum = { chainId: ETHEREUM, address: ADDRESSES.ethereum.usdc };
const usdtEthereum = { chainId: ETHEREUM, address: ADDRESSES.ethereum.usdt };
const usdtBnb = { chainId: BNB, address: '0x55d398326f99059fF775485246999027B3197955' };

describe('solidBridgeRoute', () => {
  it('takes USDC and USDT moving as themselves into and out of Fuse', () => {
    expect(solidBridgeRoute(usdcEthereum, usdcFuse)).toEqual({
      token: 'USDC',
      srcChainId: ETHEREUM,
      dstChainId: FUSE,
    });
    expect(solidBridgeRoute(usdcFuse, usdcBase)).toEqual({
      token: 'USDC',
      srcChainId: FUSE,
      dstChainId: BASE,
    });
    expect(solidBridgeRoute(usdtBnb, usdtFuse)?.token).toBe('USDT');
    expect(solidBridgeRoute(usdtFuse, usdtEthereum)?.token).toBe('USDT');
  });

  it('matches addresses whatever their case', () => {
    expect(
      solidBridgeRoute(
        { ...usdcEthereum, address: usdcEthereum.address.toLowerCase() },
        { ...usdcFuse, address: usdcFuse.address.toUpperCase().replace('0X', '0x') },
      )?.token,
    ).toBe('USDC');
  });

  it('leaves a change of coin to LI.FI', () => {
    expect(solidBridgeRoute(usdcEthereum, usdtFuse)).toBeUndefined();
    expect(solidBridgeRoute(usdcBase, { chainId: FUSE, address: WRAPPED_FUSE })).toBeUndefined();
    expect(solidBridgeRoute({ chainId: BASE, address: zeroAddress }, usdcFuse)).toBeUndefined();
  });

  it('only crosses into or out of Fuse, and only to Ethereum, Base or BNB Chain', () => {
    expect(solidBridgeRoute(usdcEthereum, usdcBase)).toBeUndefined();
    expect(solidBridgeRoute(usdcFuse, usdcFuse)).toBeUndefined();
    expect(
      solidBridgeRoute(usdcFuse, {
        chainId: ARBITRUM,
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      }),
    ).toBeUndefined();
  });
});
