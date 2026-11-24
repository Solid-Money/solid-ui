import React from 'react';
import { router } from 'expo-router';
import { arbitrum, base, fuse, mainnet } from 'viem/chains';

import CoinEarnBanner from '@/components/Coin/CoinEarnBanner';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { useSavingsVaults } from '@/hooks/useSavingsVaults';
import { TokenBalance, TokenType, VaultType } from '@/lib/types';
import { getVaultDepositToken } from '@/lib/vaults';

const { act, create } = jest.requireActual('react-test-renderer');
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
let mockWidth = 419;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth }),
}));
jest.mock('@/hooks/useAnalytics', () => ({ useMaxAPY: jest.fn() }));
jest.mock('@/hooks/useSavingsVaults', () => ({ useSavingsVaults: jest.fn() }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}));
jest.mock('@/lib/wagmi', () => ({}));

const heldToken = (symbol: string, chainId: number, balance: string): TokenBalance => ({
  chainId,
  contractAddress: getVaultDepositToken(chainId, symbol)!.address,
  contractTickerSymbol: symbol,
  contractName: symbol,
  type: symbol === 'ETH' ? TokenType.NATIVE : TokenType.ERC20,
  contractDecimals: symbol === 'ETH' ? 18 : 6,
  commonId: symbol,
  quoteRate: symbol === 'ETH' ? 3_100 : 1,
  balance,
});

let root: ReturnType<typeof create>;
const render = (coin: TokenBalance, tokens = [coin]) => {
  act(() => {
    root = create(<CoinEarnBanner token={coin} tokens={tokens} />);
  });
};

const copy = () =>
  root.root
    .findAllByType('Text')
    .flatMap((node: { children: unknown[] }) =>
      node.children.filter((child): child is string => typeof child === 'string'),
    )
    .join(' ')
    .replace(/\s+/g, ' ');

beforeEach(() => {
  (useSavingsVaults as jest.Mock).mockReturnValue({ vaults: [] });
  (useMaxAPY as jest.Mock).mockImplementation((vault: VaultType) => ({
    maxAPY: vault === VaultType.EUR ? 0 : vault === VaultType.ETH ? 2.9 : 4.5,
  }));
});

afterEach(() => {
  act(() => root.unmount());
  mockWidth = 419;
  jest.clearAllMocks();
});

it('projects the eligible USDC across networks and opens USD Yield', () => {
  const usdcBase = heldToken('USDC', base.id, '200000000');
  const usdcFuse = { ...heldToken('USDC', fuse.id, '300000000'), contractTickerSymbol: 'USDC.e' };
  const otherUsdc = { ...usdcBase, contractAddress: '0x123', balance: '999000000' };
  render(usdcBase, [usdcBase, usdcFuse, otherUsdc]);

  expect(copy()).toContain('Put it in USD Yield · about $22.50 a year');
  const button = root.root.findAllByProps({ accessibilityHint: 'Opens USD Yield' })[0];
  act(() => button.props.onPress());
  expect(router.push).toHaveBeenCalledWith({ pathname: '/savings', params: { vault: 'usdc' } });
});

it('names the idle amount and the USD Yield balance for someone who already holds USD Yield', () => {
  (useSavingsVaults as jest.Mock).mockReturnValue({ vaults: [{ key: 'USD', balance: 36.17 }] });
  render(heldToken('USDC', base.id, '18980000'));

  expect(copy()).toContain('4.5%');
  expect(copy()).toContain('a year on this $18.98');
  expect(copy()).toContain('Move it to USD Yield, with your $36.17');
  expect(copy()).not.toContain('too');
});

it('drops the balance from the subtitle once the USD Yield holding is empty', () => {
  (useSavingsVaults as jest.Mock).mockReturnValue({ vaults: [{ key: 'USD', balance: 0 }] });
  render(heldToken('USDC', base.id, '18980000'));

  expect(copy()).toContain('a year on this $18.98');
  expect(copy()).toMatch(/Move it to USD Yield$/);
});

it('shows the idle ETH in ETH, and under a cent of idle cash as less than a cent', () => {
  (useSavingsVaults as jest.Mock).mockReturnValue({
    vaults: [
      { key: 'ETH', balance: 1 },
      { key: 'USD', balance: 36.17 },
    ],
  });
  render(heldToken('ETH', mainnet.id, '150000000000000000'));
  expect(copy()).toContain('a year on this 0.15 ETH');

  act(() => root.unmount());
  render(heldToken('ETH', mainnet.id, '1234567890123456789012'));
  expect(copy()).toContain('a year on this 1,234.57 ETH');

  act(() => root.unmount());
  render(heldToken('ETH', mainnet.id, '9123456789012345'));
  expect(copy()).toContain('a year on this 0.009123 ETH');

  act(() => root.unmount());
  render(heldToken('USDC', base.id, '9999'));
  expect(copy()).toContain('a year on this <$0.01');
});

it('keeps the title on one line on a narrow phone, where it is the only text', () => {
  mockWidth = 375;
  (useSavingsVaults as jest.Mock).mockReturnValue({ vaults: [{ key: 'USD', balance: 36.17 }] });
  render(heldToken('USDC', base.id, '12345670000'));

  expect(copy()).toContain('a year on this $12,345.67');
  expect(copy()).not.toContain('Move it to');
  const title = root.root.findAllByType('Text')[0];
  expect(title.props.numberOfLines).toBe(1);
  expect(title.props.adjustsFontSizeToFit).toBe(true);
});

it('omits the offer when the wallet holds only an unsupported contract with the right ticker', () => {
  render({ ...heldToken('USDT', mainnet.id, '500000000'), chainId: base.id });
  expect(root.toJSON()).toBeNull();
  expect(useMaxAPY).not.toHaveBeenCalled();
});

it('keeps the banner for a small balance without an earnings estimate', () => {
  render(heldToken('USDT', mainnet.id, '12400000'));
  expect(copy()).toContain('Put it in USD Yield · withdraw anytime');
  expect(copy()).not.toContain('$');
});

it('omits unsupported networks from the ETH estimate on a multichain token page', () => {
  const eth = heldToken('ETH', mainnet.id, '150000000000000000');
  render(eth, [eth, { ...eth, chainId: arbitrum.id, balance: '5000000000000000000' }]);
  expect(copy()).toContain('Put it in ETH Yield · ~0.00435 ETH a year');
});

it('offers EUR Yield when analytics has yet to report a rate', () => {
  render(heldToken('EURC', base.id, '500000000'));
  expect(copy()).toContain('Earn yield on your EURC');
  expect(copy()).toContain('Put it in EUR Yield');
  expect(copy()).not.toContain('%');
});
