import { parseUnits } from 'viem';

import { VAULTS } from '@/constants/vaults';
import { groupPortfolioCash } from '@/lib/portfolio';
import { TokenBalance, TokenType, VaultType } from '@/lib/types';

import type { SpendModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';
import type { usePortfolio } from '@/hooks/usePortfolio';

export const cashToken = (
  symbol: string,
  balance: string,
  rate: number,
  chainId = 1,
): TokenBalance => ({
  contractTickerSymbol: symbol,
  contractName: symbol,
  contractDecimals: 18,
  balance: parseUnits(balance, 18).toString(),
  quoteRate: rate,
  chainId,
  type: symbol === 'ETH' || symbol === 'FUSE' ? TokenType.NATIVE : TokenType.ERC20,
  commonId: symbol,
  contractAddress: `0x${symbol === 'USDC' ? '1' : '2'.repeat(1)}`.padEnd(42, '0'),
});

export const portfolioFixture: ReturnType<typeof usePortfolio> = {
  cashAssets: groupPortfolioCash([
    cashToken('USDC', '80', 1),
    cashToken('USDC', '50', 1, 122),
    cashToken('USDC', '50', 1, 8453),
    cashToken('ETH', '0.0091', 4000),
    cashToken('FUSE', '1000', 0.012, 122),
    cashToken('SMALL1', '0.0001', 1),
    cashToken('SMALL2', '0.0001', 1),
  ]),
  cashTotal: 228.4002,
  unpricedCashCount: 0,
  isComplete: true,
  earnTotal: 2870,
  lockedFuse: 10000,
  lockedTotal: 120,
  cardBalance: 0,
  debt: 350,
  dailyYield: 0.35,
  monthlyYield: 10.6,
  totalAssets: 3218.4002,
  netBalance: 2868.4002,
  isLoading: false,
  isError: false,
  refresh: async () => {},
  nextUnlockAt: '2027-03-12T00:00:00Z',
  hasCardBalance: false,
  creditDetailsAvailable: true,
  earnAssets: VAULTS.map(vault => ({
    vault,
    valueUsd: vault.type === VaultType.USDC ? 2560 : vault.type === VaultType.ETH ? 310 : 0,
    underlyingAmount: vault.type === VaultType.ETH ? 0.0775 : undefined,
    isComplete: true,
    backsCredit: vault.type === VaultType.USDC,
    apy: vault.type === VaultType.USDC ? 4.5 : 2.9,
    walletTokens:
      vault.type === VaultType.ETH
        ? [
            {
              ...cashToken('soETH', '0.0761', 4073, 8453),
              contractAddress: vault.vaults[0].address,
            },
          ]
        : [],
    shareAmount:
      vault.type === VaultType.USDC ? 2365.5 : vault.type === VaultType.ETH ? 0.0761 : undefined,
    shareNetworkCount: vault.type === VaultType.FUSE ? 0 : 1,
  })),
};

export const spendFixture: SpendModeFigures = {
  mode: 'credit',
  pendingMode: null,
  canChangeMode: true,
  cashBalance: '$228.40',
  borrowed: '$350.00',
  creditLimit: '$2,000.00',
  availableToBorrow: '$1,650.00',
  borrowApy: '5.57%',
  borrowedProgress: 0.175,
  segmentValue: { cash: '$228.40', credit: '$1,650.00', smart: '$1,650.00' },
  hasPosition: true,
  canBorrow: true,
  showsBorrowPosition: true,
  risk: 'none',
  healthFactor: 2,
  fullyPriced: true,
  isLoading: false,
};
