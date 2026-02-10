import { QueryClient } from '@tanstack/react-query';
import { formatUnits, zeroAddress } from 'viem';

import { getInfoClient } from '@/graphql/clients';
import {
  GetExchangeRateUpdatesDocument,
  GetExchangeRateUpdatesQuery,
} from '@/graphql/generated/user-info';
import { useBalanceStore } from '@/store/useBalanceStore';

import { ADDRESSES } from './config';
import { SavingMode } from './types';

export const SECONDS_PER_YEAR = 31_557_600;

// Cache for API responses to prevent repeated calls
const exchangeRateCache = new Map<string, { data: Map<number, number>; timestamp: number }>();
const vaultTransfersCache = new Map<string, { data: FuseTransferData[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Clear cache functions
export const clearExchangeRateCache = () => {
  exchangeRateCache.clear();
};

export const clearVaultTransfersCache = (safeAddress?: string, tokenAddress?: string) => {
  if (safeAddress) {
    const key = tokenAddress
      ? `${safeAddress.toLowerCase()}-${tokenAddress.toLowerCase()}`
      : safeAddress.toLowerCase();
    vaultTransfersCache.forEach((_, k) => {
      if (k.startsWith(key)) vaultTransfersCache.delete(k);
    });
  } else {
    vaultTransfersCache.clear();
  }
};

// Types for deposit/withdrawal data
interface DepositData {
  depositAmount: string;
  depositTimestamp: string;
  isBridged: boolean;
}

interface WithdrawalData {
  amountOfAssets: string;
  creationTime: string;
  requestStatus: string;
}

interface FuseTransferData {
  from: string;
  to: string;
  value: string;
  timestamp: string;
  token: {
    address: string;
    symbol: string;
    decimals: number;
  };
}

interface TimeWeightedBalance {
  amount: number;
  timestamp: number;
  type: 'deposit' | 'withdrawal' | 'transfer_out' | 'transfer_in';
}
// Fetch historical exchange rates from subgraph using Apollo Client with caching
export const fetchHistoricalExchangeRates = async (
  timestamps: number[],
): Promise<Map<number, number>> => {
  try {
    if (timestamps.length === 0) return new Map();

    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    const cacheKey = `${minTimestamp}-${maxTimestamp}`;
    const now = Date.now();

    // Check cache first
    const cached = exchangeRateCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    // Use Apollo Client with the generated query
    const { data } = await getInfoClient().query<GetExchangeRateUpdatesQuery>({
      query: GetExchangeRateUpdatesDocument,
      variables: {
        minTimestamp: minTimestamp.toString(),
        maxTimestamp: maxTimestamp.toString(),
      },
      fetchPolicy: 'cache-first', // Use Apollo's built-in caching
    });

    const updates = data?.exchangeRateUpdates || [];

    // Create a map of timestamp -> exchange rate
    const rateMap = new Map<number, number>();

    updates.forEach((update: any) => {
      const timestamp = Number(update.timestamp);
      const rate = Number(formatUnits(BigInt(update.exchangeRate), 6));
      rateMap.set(timestamp, rate);
    });

    // Cache the result
    exchangeRateCache.set(cacheKey, { data: rateMap, timestamp: now });

    return rateMap;
  } catch (error) {
    console.warn('Error fetching historical exchange rates:', error);
    return new Map();
  }
};

// Get exchange rate for a specific timestamp (with fallback to nearest available rate)
export const getExchangeRateAtTimestamp = (
  timestamp: number,
  rateMap: Map<number, number>,
  fallbackRate: number,
): number => {
  if (rateMap.has(timestamp)) {
    return rateMap.get(timestamp)!;
  }

  // Find the closest available rate before this timestamp
  let closestRate = fallbackRate;
  let closestTimestamp = 0;

  for (const [rateTimestamp, rate] of rateMap.entries()) {
    if (rateTimestamp <= timestamp && rateTimestamp > closestTimestamp) {
      closestRate = rate;
      closestTimestamp = rateTimestamp;
    }
  }

  return closestRate;
};

// Fetch vault token transfers from Fuse API with caching
export const fetchVaultTransfers = async (
  safeAddress: string,
  tokenAddress: string,
  decimals: number,
): Promise<FuseTransferData[]> => {
  const now = Date.now();
  const cacheKey = `${safeAddress.toLowerCase()}-${tokenAddress.toLowerCase()}`;

  // Check cache first
  const cached = vaultTransfersCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    // Fetch both incoming and outgoing transfers
    const [fromResponse, toResponse] = await Promise.all([
      fetch(
        `https://explorer.fuse.io/api/v2/addresses/${safeAddress}/token-transfers?type=ERC-20&filter=from&token=${tokenAddress}`,
      ),
      fetch(
        `https://explorer.fuse.io/api/v2/addresses/${safeAddress}/token-transfers?type=ERC-20&filter=to&token=${tokenAddress}`,
      ),
    ]);

    const [fromData, toData] = await Promise.all([
      fromResponse.ok ? fromResponse.json() : { items: [] },
      toResponse.ok ? toResponse.json() : { items: [] },
    ]);

    const allItems = [...(fromData.items || []), ...(toData.items || [])];

    // Transform the response to match our expected format
    const transfers = allItems.map((item: any) => ({
      from: item.from?.hash || '',
      to: item.to?.hash || '',
      value: item.total?.value || '0',
      timestamp: item.timestamp || '',
      token: {
        address: item.token?.address_hash || '',
        symbol: item.token?.symbol || '',
        decimals: parseInt(item.token?.decimals || decimals.toString()),
      },
    }));

    // Cache the result
    vaultTransfersCache.set(cacheKey, { data: transfers, timestamp: now });

    return transfers;
  } catch (error) {
    console.warn('Error fetching vault transfers:', error);
    return [];
  }
};

// Calculate actual deposited amount from subgraph data and Fuse transfers
export const calculateActualDepositedAmount = async (
  deposits: DepositData[],
  withdrawals: WithdrawalData[],
  safeAddress: string,
  currentBalance: number,
  exchangeRate: number,
  tokenAddress: string = ADDRESSES.fuse.vault,
  decimals: number = 6,
): Promise<{ actualDeposited: number; timeWeightedBalances: TimeWeightedBalance[] }> => {
  const timeWeightedBalances: TimeWeightedBalance[] = [];
  const allTimestamps: number[] = [];

  // Collect all timestamps first (deposits and withdrawals)
  deposits.forEach(deposit => {
    if (deposit.depositAmount && deposit.depositAmount !== '0') {
      allTimestamps.push(Number(deposit.depositTimestamp));
    }
  });

  withdrawals.forEach(withdrawal => {
    if (
      withdrawal.amountOfAssets &&
      withdrawal.amountOfAssets !== '0' &&
      withdrawal.requestStatus === 'SOLVED'
    ) {
      allTimestamps.push(Number(withdrawal.creationTime));
    }
  });

  // USDC vault spans two chains; we need transfers from both to match summed balance
  const isUsdcVault =
    tokenAddress.toLowerCase() === ADDRESSES.fuse.vault.toLowerCase() ||
    tokenAddress.toLowerCase() === ADDRESSES.ethereum.vault.toLowerCase();

  const vaultTransferAddresses = isUsdcVault
    ? [ADDRESSES.ethereum.vault, ADDRESSES.fuse.vault]
    : [tokenAddress];

  const vaultTransfersArrays = await Promise.all(
    vaultTransferAddresses.map(addr => fetchVaultTransfers(safeAddress, addr, decimals)),
  );
  const vaultTransfers = vaultTransfersArrays.flat();
  const filteredVaultTransfers = vaultTransfers.filter(
    transfer =>
      transfer.from !== zeroAddress &&
      transfer.to !== zeroAddress &&
      transfer.to !== ADDRESSES.fuse.bridgePaymasterAddress,
  );

  // Collect Vault transfer timestamps
  filteredVaultTransfers.forEach(transfer => {
    const timestamp = Math.floor(new Date(transfer.timestamp).getTime() / 1000);
    allTimestamps.push(timestamp);
  });

  // Fetch historical exchange rates for USDC (soUSD) vaults on both chains
  const historicalRates = isUsdcVault
    ? await fetchHistoricalExchangeRates(allTimestamps)
    : new Map<number, number>();

  // Helper: same unit as balanceUSD (USD for USDC, token for others)
  const toDisplayAmount = (tokenAmount: number, timestamp: number): number => {
    const rateAtTime = isUsdcVault
      ? getExchangeRateAtTimestamp(timestamp, historicalRates, exchangeRate)
      : exchangeRate;
    return tokenAmount * rateAtTime;
  };

  // Process deposits (convert to display unit so actualDeposited matches balanceUSD)
  deposits.forEach(deposit => {
    if (deposit.depositAmount && deposit.depositAmount !== '0') {
      try {
        const tokenAmount = Number(formatUnits(BigInt(deposit.depositAmount), decimals));
        if (isFinite(tokenAmount) && tokenAmount > 0) {
          const timestamp = Number(deposit.depositTimestamp);
          timeWeightedBalances.push({
            amount: toDisplayAmount(tokenAmount, timestamp),
            timestamp,
            type: 'deposit',
          });
        }
      } catch (error) {
        console.warn('Error processing deposit:', error);
      }
    }
  });

  // Process withdrawals (convert to display unit)
  withdrawals.forEach(withdrawal => {
    if (
      withdrawal.amountOfAssets &&
      withdrawal.amountOfAssets !== '0' &&
      withdrawal.requestStatus === 'SOLVED'
    ) {
      try {
        const tokenAmount = Number(formatUnits(BigInt(withdrawal.amountOfAssets), decimals));
        if (isFinite(tokenAmount) && tokenAmount > 0) {
          const timestamp = Number(withdrawal.creationTime);
          timeWeightedBalances.push({
            amount: -toDisplayAmount(tokenAmount, timestamp),
            timestamp,
            type: 'withdrawal',
          });
        }
      } catch (error) {
        console.warn('Error processing withdrawal:', error);
      }
    }
  });

  // Process Vault transfers
  filteredVaultTransfers.forEach(transfer => {
    try {
      const tokenAmount = Number(formatUnits(BigInt(transfer.value), transfer.token.decimals));
      if (isFinite(tokenAmount) && tokenAmount > 0) {
        const timestamp = Math.floor(new Date(transfer.timestamp).getTime() / 1000);

        // For USDC, we use historical rates to get USD value at that time
        // For others, we use current exchange rate as fallback (best effort)
        const rateAtTime = isUsdcVault
          ? getExchangeRateAtTimestamp(timestamp, historicalRates, exchangeRate)
          : exchangeRate;

        const usdAmount = tokenAmount * rateAtTime;

        if (transfer.from.toLowerCase() === safeAddress.toLowerCase()) {
          // Transfer out (reduces balance)
          timeWeightedBalances.push({
            amount: -usdAmount,
            timestamp,
            type: 'transfer_out',
          });
        } else if (transfer.to.toLowerCase() === safeAddress.toLowerCase()) {
          // Transfer in (increases balance)
          timeWeightedBalances.push({
            amount: usdAmount,
            timestamp,
            type: 'transfer_in',
          });
        }
      }
    } catch (error) {
      console.warn('Error processing Vault transfer:', error);
    }
  });

  // Sort by timestamp
  timeWeightedBalances.sort((a, b) => a.timestamp - b.timestamp);

  // Calculate actual deposited amount by summing all positive changes (now in USD/Base Currency)
  const actualDeposited = timeWeightedBalances.reduce((total, balance) => {
    return total + balance.amount;
  }, 0);

  return { actualDeposited, timeWeightedBalances };
};

export const calculateYield = async (
  balance: number,
  apy: number,
  lastTimestamp: number,
  currentTime: number,
  mode: SavingMode = SavingMode.TOTAL_USD,
  queryClient: QueryClient,
  userDepositTransactions?: any,
  safeAddress?: string,
  exchangeRate: number = 1,
  tokenAddress: string = ADDRESSES.fuse.vault,
  decimals: number = 6,
): Promise<number> => {
  if (balance <= 0 || !isFinite(balance)) return 0;
  if (mode === SavingMode.BALANCE_ONLY) return balance;
  if (!isFinite(apy) || apy < 0) return mode === SavingMode.INTEREST_ONLY ? 0 : balance;
  if (!lastTimestamp || lastTimestamp <= 0) return mode === SavingMode.INTEREST_ONLY ? 0 : balance;
  if (!currentTime || currentTime <= 0) return mode === SavingMode.INTEREST_ONLY ? 0 : balance;

  const { earnedUSD, setEarnedUSD } = useBalanceStore.getState();
  // console.log('earnedUSD', earnedUSD);
  // console.log('balance', balance);

  // balance is in tokens. exchangeRate converts token to USD/Display Currency
  const balanceUSD = balance * exchangeRate;

  // If we have deposit transaction data and safe address, use the new calculation
  if (
    userDepositTransactions &&
    safeAddress &&
    userDepositTransactions.deposits &&
    userDepositTransactions.withdraws
  ) {
    try {
      const { actualDeposited, timeWeightedBalances } = await calculateActualDepositedAmount(
        userDepositTransactions.deposits,
        userDepositTransactions.withdraws,
        safeAddress,
        balance,
        exchangeRate,
        tokenAddress,
        decimals,
      );

      if (timeWeightedBalances.length > 0) {
        let interestEarnedUSD = balanceUSD - actualDeposited;

        if (interestEarnedUSD > 0) {
          setEarnedUSD(interestEarnedUSD);
        }

        // Don't fall back to global earnedUSD (other vault's value); clamp to 0
        if (interestEarnedUSD < 0) {
          interestEarnedUSD = 0;
        }

        const amountGained =
          (((apy / 100) * (currentTime - lastTimestamp)) / 1000 / SECONDS_PER_YEAR) * balanceUSD;

        if (mode === SavingMode.CURRENT) {
          return Math.max(0, interestEarnedUSD + amountGained);
        }

        if (mode === SavingMode.INTEREST_ONLY) {
          return Math.max(0, interestEarnedUSD);
        }

        if (mode === SavingMode.TOTAL_USD) {
          return balanceUSD + amountGained;
        }

        if (mode === SavingMode.TOTAL) {
          // Convert current balance to USD and add interest
          return balanceUSD + interestEarnedUSD;
        }

        if (mode === SavingMode.ALL_TIME) {
          if (actualDeposited <= 0) return 0;

          const totalReturn = balanceUSD - actualDeposited;
          const totalReturnPercentage = (totalReturn / actualDeposited) * 100;
          return totalReturnPercentage;
        }

        return balanceUSD + interestEarnedUSD;
      }
    } catch (error) {
      console.warn(
        'Error in deposit history calculation, falling back to simple calculation:',
        error,
      );
    }
  }

  // Fallback to original calculation
  const deltaTime = Math.max(0, currentTime - lastTimestamp);
  if (deltaTime === 0) {
    if (mode === SavingMode.INTEREST_ONLY || mode === SavingMode.CURRENT) return 0;
    if (mode === SavingMode.TOTAL_USD) return balanceUSD;
    return balance;
  }

  const timeInYears = deltaTime / SECONDS_PER_YEAR;

  const interestEarned = balance * (apy / 100) * timeInYears;
  const interestEarnedUSD = balanceUSD * (apy / 100) * timeInYears;

  if (mode === SavingMode.INTEREST_ONLY) {
    return Math.max(0, interestEarnedUSD);
  }

  if (mode === SavingMode.TOTAL) {
    return balance + interestEarned;
  }

  if (mode === SavingMode.ALL_TIME) {
    const estimatedOriginalDeposit = balanceUSD - interestEarnedUSD;
    if (estimatedOriginalDeposit <= 0) return 0;

    const totalReturn = balanceUSD - estimatedOriginalDeposit;
    const totalReturnPercentage = (totalReturn / estimatedOriginalDeposit) * 100;
    return totalReturnPercentage;
  }

  if (mode === SavingMode.CURRENT) {
    return Math.max(0, interestEarnedUSD);
  }

  if (mode === SavingMode.TOTAL_USD) {
    return balanceUSD + interestEarnedUSD;
  }

  return balanceUSD + interestEarnedUSD;
};

export const calculateOriginalDepositAmount = (
  userDepositTransactions: any,
  decimals: number = 6,
): number => {
  if (!userDepositTransactions?.deposits?.length) {
    return 0;
  }

  return userDepositTransactions.deposits.reduce((total: number, deposit: any) => {
    if (!deposit.depositAmount || deposit.depositAmount === '0') {
      return total;
    }

    try {
      const depositAmount = Number(formatUnits(BigInt(deposit.depositAmount), decimals));

      return isFinite(depositAmount) && depositAmount > 0 ? total + depositAmount : total;
    } catch {
      return total;
    }
  }, 0);
};

export const getEarliestDepositTimestamp = (
  userDepositTransactions: any,
  fallbackTimestamp?: number,
): number | undefined => {
  if (!userDepositTransactions?.deposits?.length) {
    return fallbackTimestamp;
  }

  const deposits = userDepositTransactions.deposits || [];
  const withdrawals = userDepositTransactions.withdraws || [];

  if (!withdrawals.length) {
    const earliestDeposit = deposits.reduce((earliest: any, deposit: any) => {
      const depositTime = Number(deposit.depositTimestamp);
      const earliestTime = earliest ? Number(earliest.depositTimestamp) : Infinity;
      return depositTime > 0 && depositTime < earliestTime ? deposit : earliest;
    }, null);
    return earliestDeposit ? Number(earliestDeposit.depositTimestamp) : fallbackTimestamp;
  }

  const mostRecentWithdrawal = withdrawals.reduce((latest: any, withdrawal: any) => {
    const withdrawalTime = Number(withdrawal.creationTime);
    const latestTime = latest ? Number(latest.creationTime) : 0;
    return withdrawalTime > latestTime ? withdrawal : latest;
  }, null);

  if (!mostRecentWithdrawal) {
    const earliestDeposit = deposits.reduce((earliest: any, deposit: any) => {
      const depositTime = Number(deposit.depositTimestamp);
      const earliestTime = earliest ? Number(earliest.depositTimestamp) : Infinity;
      return depositTime > 0 && depositTime < earliestTime ? deposit : earliest;
    }, null);
    return earliestDeposit ? Number(earliestDeposit.depositTimestamp) : fallbackTimestamp;
  }

  const mostRecentWithdrawalTime = Number(mostRecentWithdrawal.creationTime);

  const depositsAfterWithdrawal = deposits.filter((deposit: any) => {
    return Number(deposit.depositTimestamp) > mostRecentWithdrawalTime;
  });

  if (depositsAfterWithdrawal.length > 0) {
    const earliestDepositAfterWithdrawal = depositsAfterWithdrawal.reduce(
      (earliest: any, deposit: any) => {
        const depositTime = Number(deposit.depositTimestamp);
        const earliestTime = earliest ? Number(earliest.depositTimestamp) : Infinity;
        return depositTime > 0 && depositTime < earliestTime ? deposit : earliest;
      },
      null,
    );
    return Number(earliestDepositAfterWithdrawal.depositTimestamp);
  }

  const mostRecentDeposit = deposits.reduce((latest: any, deposit: any) => {
    const depositTime = Number(deposit.depositTimestamp);
    const latestTime = latest ? Number(latest.depositTimestamp) : 0;
    return depositTime > latestTime ? deposit : latest;
  }, null);

  return mostRecentDeposit ? Number(mostRecentDeposit.depositTimestamp) : fallbackTimestamp;
};
