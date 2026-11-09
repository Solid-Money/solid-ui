import { zeroAddress } from 'viem';

import {
  coinSwapPreset,
  HOME_SWAP_PRESET,
  USD_YIELD_ON_FUSE,
  USDC_ON_FUSE,
} from '@/lib/swapDefaults';
import { TokenBalance, TokenType } from '@/lib/types';

const USDC_ON_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const token = (overrides: Partial<TokenBalance>): TokenBalance => ({
  contractTickerSymbol: 'ETH',
  contractName: 'Ether',
  contractAddress: '0x4200000000000000000000000000000000000006',
  balance: '1000',
  contractDecimals: 18,
  type: TokenType.ERC20,
  chainId: 8453,
  ...overrides,
});

describe('swap presets', () => {
  it('opens Home on USD Yield to USDC', () => {
    expect(HOME_SWAP_PRESET).toEqual({ input: USD_YIELD_ON_FUSE, output: USDC_ON_FUSE });
  });

  it('pays with a held coin, into USDC on its own network', () => {
    expect(coinSwapPreset(token({}))).toEqual({
      input: { address: '0x4200000000000000000000000000000000000006', chainId: 8453 },
      output: { address: USDC_ON_BASE, chainId: 8453 },
    });
  });

  it('gets a coin that isn’t held, with USDC on its own network', () => {
    expect(coinSwapPreset(token({ balance: '0' }))).toEqual({
      input: { address: USDC_ON_BASE, chainId: 8453 },
      output: { address: '0x4200000000000000000000000000000000000006', chainId: 8453 },
    });
  });

  it('pairs USDC off Fuse with USDT on the same network', () => {
    expect(coinSwapPreset(token({ contractAddress: USDC_ON_BASE.toLowerCase() })).output).toEqual({
      address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      chainId: 8453,
    });
  });

  it('pairs a Fuse coin with USDC on Fuse', () => {
    expect(
      coinSwapPreset(token({ type: TokenType.NATIVE, contractAddress: '0xeeee', chainId: 122 })),
    ).toEqual({ input: { address: zeroAddress, chainId: 122 }, output: USDC_ON_FUSE });
  });

  it('uses the zero address for a native coin', () => {
    expect(
      coinSwapPreset(token({ type: TokenType.NATIVE, contractAddress: '0xeeee' })).input,
    ).toEqual({ address: zeroAddress, chainId: 8453 });
  });

  it('pairs USDC’s own page with USD Yield', () => {
    const usdc = token({
      contractAddress: USDC_ON_FUSE.address.toLowerCase(),
      chainId: USDC_ON_FUSE.chainId,
    });
    expect(coinSwapPreset(usdc)).toEqual({
      input: { address: USDC_ON_FUSE.address.toLowerCase(), chainId: USDC_ON_FUSE.chainId },
      output: USD_YIELD_ON_FUSE,
    });
  });

  it('leaves the pair alone without a coin', () => {
    expect(coinSwapPreset(undefined)).toEqual({});
  });
});
