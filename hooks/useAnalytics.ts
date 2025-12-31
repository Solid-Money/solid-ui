import { infoClient } from '@/graphql/clients';
import { QueryClient, useQuery } from '@tanstack/react-query';
import { formatUnits } from 'viem';
import { fuse, mainnet } from 'viem/chains';

import { explorerUrls, layerzero } from '@/constants/explorers';
import {
  GetUserTransactionsDocument,
  GetUserTransactionsQuery,
} from '@/graphql/generated/user-info';
import {
  bridgeDepositTransactions,
  depositTransactions,
  fetchAPYs,
  fetchCoinHistoricalChart,
  fetchHistoricalAPY,
  fetchLayerZeroBridgeTransactions,
  fetchTokenTransfer,
  fetchTotalAPY,
  fetchTVL,
  fetchVaultBreakdown,
  getBankTransfers,
  searchCoin,
} from '@/lib/api';
import { ADDRESSES, EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT } from '@/lib/config';
import {
  BankTransferActivityItem,
  BankTransferStatus,
  BlockscoutTransaction,
  BlockscoutTransactions,
  BridgeTransaction,
  BridgeTransactionStatus,
  DepositTransaction,
  DepositTransactionStatus,
  LayerZeroTransactionStatus,
  Transaction,
  TransactionStatus,
  TransactionType,
  VaultBreakdown,
} from '@/lib/types';
import { BridgeApiTransfer } from '@/lib/types/bank-transfer';
import { withRefreshToken } from '@/lib/utils';
import { secondsToMilliseconds } from 'date-fns';

const ANALYTICS = 'analytics';
const ApyToDays = {
  sevenDay: 7,
  fifteenDay: 15,
  thirtyDay: 30,
};

const safeFormatUnits = (
  value: string | number | bigint | null | undefined,
  decimals: number,
): string => {
  try {
    const asBigInt = typeof value === 'bigint' ? value : BigInt(String(value ?? '0'));
    return formatUnits(asBigInt, decimals);
  } catch {
    return '0';
  }
};

const mapToTransactionStatus = (
  status: LayerZeroTransactionStatus | BankTransferStatus,
): TransactionStatus => {
  if (
    status === LayerZeroTransactionStatus.DELIVERED ||
    status === BankTransferStatus.PAYMENT_PROCESSED
  ) {
    return TransactionStatus.SUCCESS;
  }

  if (
    status === LayerZeroTransactionStatus.INFLIGHT ||
    status === LayerZeroTransactionStatus.CONFIRMING ||
    status === BankTransferStatus.AWAITING_FUNDS ||
    status === BankTransferStatus.FUNDS_RECEIVED
  ) {
    return TransactionStatus.PENDING;
  }

  return TransactionStatus.FAILED;
};

export const useTotalAPY = () => {
  return useQuery({
    queryKey: [ANALYTICS, 'totalAPY'],
    queryFn: fetchTotalAPY,
  });
};

export const useLatestTokenTransfer = (address: string, token: string) => {
  return useQuery({
    queryKey: [ANALYTICS, 'latestTokenTransfer', address, token],
    queryFn: async () => {
      if (!address) return 0;
      const response = await fetchTokenTransfer({ address, token });
      const latest = response.items.reduce((prev, curr) =>
        new Date(curr.timestamp) > new Date(prev.timestamp) ? curr : prev,
      );
      return new Date(latest.timestamp).getTime();
    },
    enabled: !!address,
  });
};

const filterTransfers = (transfers: BlockscoutTransactions) => {
  return transfers.items.filter(transfer => {
    const name = transfer.to.name;
    const isSafe = name?.toLowerCase().includes('safe');
    const isTokenTransfer = transfer.type === 'token_transfer';
    const toAddress = transfer.to.hash.toLowerCase();

    if (
      (!name || isSafe) &&
      isTokenTransfer &&
      toAddress !== ADDRESSES.ethereum.bridgePaymasterAddress.toLowerCase() &&
      toAddress !== ADDRESSES.fuse.bridgePaymasterAddress.toLowerCase()
    ) {
      return transfer;
    }
  });
};

export const userTransactionsQueryOptions = (safeAddress: string | undefined) => ({
  queryKey: ['user-transactions', safeAddress?.toLowerCase()],
  queryFn: async () => {
    if (!safeAddress) return undefined;
    const { data } = await infoClient.query<GetUserTransactionsQuery>({
      query: GetUserTransactionsDocument,
      variables: {
        address: safeAddress.toLowerCase(),
      },
      fetchPolicy: 'cache-first',
    });
    return data;
  },
  enabled: !!safeAddress,
  staleTime: secondsToMilliseconds(60), // Data is fresh for 60 seconds
  gcTime: secondsToMilliseconds(300), // Keep in cache for 5 minutes
});

export const useUserTransactions = (safeAddress: string | undefined) => {
  return useQuery(userTransactionsQueryOptions(safeAddress));
};

export const useSendTransactions = (address: string) => {
  return useQuery({
    queryKey: [ANALYTICS, 'sendTransactions', address],
    queryFn: async () => {
      const fuseTransfers = await fetchTokenTransfer({
        address,
        filter: 'from',
      });

      const ethereumTransfers = await fetchTokenTransfer({
        address,
        filter: 'from',
        explorerUrl: explorerUrls[mainnet.id].blockscout,
      });

      const filteredFuseTransfers = filterTransfers(fuseTransfers);
      const filteredEthereumTransfers = filterTransfers(ethereumTransfers);

      return {
        fuse: filteredFuseTransfers,
        ethereum: filteredEthereumTransfers,
      };
    },
    enabled: !!address,
    staleTime: secondsToMilliseconds(30),
  });
};

const constructSendTransaction = (
  transfer: BlockscoutTransaction,
  rawStatus: LayerZeroTransactionStatus,
  explorerUrl?: string,
) => {
  const hash = transfer.transaction_hash;
  const symbol = transfer.token.symbol;

  return {
    title: `Send ${symbol}`,
    timestamp: (new Date(transfer.timestamp).getTime() / 1000).toString(),
    amount: safeFormatUnits(transfer.total.value, Number(transfer.total.decimals)),
    symbol,
    status: mapToTransactionStatus(rawStatus),
    hash,
    url: `${explorerUrl}/tx/${hash}`,
    type: TransactionType.SEND,
    logoUrl: transfer.token.icon_url,
  };
};

export const useDepositTransactions = (safeAddress: string) => {
  return useQuery({
    queryKey: [ANALYTICS, 'depositTransactions', safeAddress],
    queryFn: async () => {
      return await depositTransactions(safeAddress);
    },
    enabled: !!safeAddress,
    staleTime: secondsToMilliseconds(30),
  });
};

export const useBridgeDepositTransactions = (safeAddress: string) => {
  return useQuery({
    queryKey: [ANALYTICS, 'bridgeDepositTransactions', safeAddress],
    queryFn: async () => {
      return await bridgeDepositTransactions(safeAddress);
    },
    enabled: !!safeAddress,
    staleTime: secondsToMilliseconds(30),
  });
};

export const useBankTransferTransactions = () => {
  return useQuery({
    queryKey: [ANALYTICS, 'bankTransferTransactions'],
    queryFn: async () => {
      const data = (await withRefreshToken(() => getBankTransfers())) ?? [];

      const items: BankTransferActivityItem[] = data.map((it: BridgeApiTransfer) => ({
        id: it.id,
        amount: Number(it.amount || '0'),
        currency: String(it.currency || 'usd').toUpperCase(),
        method: it.source?.payment_rail as any,
        status: (it.state as string).toLowerCase() as BankTransferStatus,
        timestamp: Math.floor(new Date(it.created_at).getTime() / 1000),
        url: undefined,
        sourceDepositInstructions: it.source_deposit_instructions,
      }));
      return items;
    },
    enabled: true,
    staleTime: secondsToMilliseconds(30),
  });
};

const constructDepositTransaction = (transaction: DepositTransaction) => {
  const isCompleted = transaction.status === DepositTransactionStatus.DEPOSIT_COMPLETED;
  const isFailed =
    transaction.status === DepositTransactionStatus.FAILED ||
    transaction.status === DepositTransactionStatus.DEPOSIT_FAILED;

  const hash = transaction.depositTxHash;
  const explorerUrl = explorerUrls[layerzero.id].layerzeroscan;
  const url = hash ? `${explorerUrl}/tx/${hash}` : undefined;

  const rawStatus = isCompleted
    ? LayerZeroTransactionStatus.DELIVERED
    : isFailed
      ? LayerZeroTransactionStatus.FAILED
      : LayerZeroTransactionStatus.INFLIGHT;

  const status = mapToTransactionStatus(rawStatus);

  return {
    title: 'Deposit USDC',
    timestamp: Math.floor(new Date(transaction.createdAt).getTime() / 1000).toString(),
    amount: safeFormatUnits(transaction.amount, transaction.decimals),
    symbol: 'soUsd',
    status,
    hash,
    url,
    type: TransactionType.DEPOSIT,
    trackingId: transaction.trackingId,
    failureReason: transaction.errorMessage,
  };
};

const constructBridgeDepositTransaction = (transaction: BridgeTransaction) => {
  const isCompleted = transaction.status === BridgeTransactionStatus.DEPOSIT_COMPLETED;
  const isFailed =
    transaction.status === BridgeTransactionStatus.FAILED ||
    transaction.status === BridgeTransactionStatus.BRIDGE_FAILED ||
    transaction.status === BridgeTransactionStatus.DEPOSIT_FAILED;

  const hash = transaction.depositTxHash;
  const explorerUrl = explorerUrls[layerzero.id].layerzeroscan;
  const url = hash ? `${explorerUrl}/tx/${hash}` : undefined;

  const rawStatus = isCompleted
    ? LayerZeroTransactionStatus.DELIVERED
    : isFailed
      ? LayerZeroTransactionStatus.FAILED
      : LayerZeroTransactionStatus.INFLIGHT;

  const status = mapToTransactionStatus(rawStatus);

  return {
    title: 'Deposit USDC',
    timestamp: Math.floor(new Date(transaction.createdAt).getTime() / 1000).toString(),
    amount: safeFormatUnits(transaction.toAmount, transaction.decimals),
    symbol: 'soUsd',
    status,
    hash,
    url,
    type: TransactionType.DEPOSIT,
    trackingId: transaction.trackingId,
    failureReason: transaction.errorMessage,
  };
};

export const formatTransactions = async (
  transactions: GetUserTransactionsQuery | undefined,
  sendTransactions:
    | {
        fuse: BlockscoutTransaction[];
        ethereum: BlockscoutTransaction[];
      }
    | undefined,
  depositTransactions: DepositTransaction[] | undefined,
  bridgeDepositTransactions: BridgeTransaction[] | undefined,
  bankTransfers: BankTransferActivityItem[] | undefined,
): Promise<Transaction[]> => {
  const unsponsorDepositTransactionPromises = transactions?.deposits?.map(
    async internalTransaction => {
      const hash = internalTransaction.transactionHash;
      const amount = safeFormatUnits(internalTransaction.depositAmount, 6);

      const isSponsor = Number(amount) >= Number(EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT);
      if (isSponsor) {
        return;
      }

      try {
        const lzTransactions = await fetchLayerZeroBridgeTransactions(hash);

        const rawStatus =
          lzTransactions?.data?.[0]?.status?.name || LayerZeroTransactionStatus.INFLIGHT;
        const status = mapToTransactionStatus(rawStatus);

        return {
          title: 'Deposit USDC',
          timestamp: internalTransaction.depositTimestamp,
          amount,
          symbol: 'soUsd',
          status,
          hash,
          url: `${explorerUrls[layerzero.id].layerzeroscan}/tx/${hash}`,
          type: TransactionType.DEPOSIT,
        };
      } catch (error: any) {
        console.error('Failed to fetch LZ transaction:', error);
        return {
          title: 'Deposit USDC',
          timestamp: internalTransaction.depositTimestamp,
          amount,
          symbol: 'soUsd',
          status: mapToTransactionStatus(
            error.response.status === 404
              ? LayerZeroTransactionStatus.INFLIGHT
              : LayerZeroTransactionStatus.FAILED,
          ),
          hash,
          url: `${explorerUrls[layerzero.id].layerzeroscan}/tx/${hash}`,
          type: TransactionType.DEPOSIT,
        };
      }
    },
  );

  const bridgeTransactionPromises = transactions?.bridges?.map(async internalTransaction => {
    const hash = internalTransaction.transactionHash;
    try {
      const lzTransactions = await fetchLayerZeroBridgeTransactions(hash);

      const rawStatus =
        lzTransactions?.data?.[0]?.status?.name || LayerZeroTransactionStatus.INFLIGHT;
      const status = mapToTransactionStatus(rawStatus);

      return {
        title: 'Withdraw USDC',
        timestamp: internalTransaction.blockTimestamp,
        amount: safeFormatUnits(internalTransaction.shareAmount, 6),
        symbol: 'soUSD',
        status,
        hash,
        url: `${explorerUrls[layerzero.id].layerzeroscan}/tx/${hash}`,
        type: TransactionType.UNSTAKE,
      };
    } catch (error: any) {
      console.error('Failed to fetch LZ transaction:', error);
      return {
        title: 'Withdraw USDC',
        timestamp: internalTransaction.blockTimestamp,
        amount: safeFormatUnits(internalTransaction.shareAmount, 6),
        symbol: 'soUSD',
        status: mapToTransactionStatus(
          error.response.status === 404
            ? LayerZeroTransactionStatus.INFLIGHT
            : LayerZeroTransactionStatus.FAILED,
        ),
        hash,
        url: `${explorerUrls[layerzero.id].layerzeroscan}/tx/${hash}`,
        type: TransactionType.UNSTAKE,
      };
    }
  });

  const withdrawTransactionPromises = transactions?.withdraws?.map(async internalTransaction => {
    const hash =
      internalTransaction.requestStatus === 'SOLVED'
        ? internalTransaction.solveTxHash
        : internalTransaction.requestTxHash;

    return {
      title: 'Withdraw soUSD',
      timestamp: internalTransaction.creationTime,
      amount: safeFormatUnits(internalTransaction.amountOfAssets, 6),
      symbol: 'soUSD',
      status: mapToTransactionStatus(
        internalTransaction.requestStatus === 'SOLVED'
          ? LayerZeroTransactionStatus.DELIVERED
          : internalTransaction.requestStatus === 'CANCELLED'
            ? LayerZeroTransactionStatus.FAILED
            : LayerZeroTransactionStatus.INFLIGHT,
      ),
      hash,
      url: `${explorerUrls[mainnet.id].etherscan}/tx/${hash}`,
      type: TransactionType.WITHDRAW,
      requestId: internalTransaction.requestId as `0x${string}`,
    };
  });

  const sendTransactionPromises = [
    ...(sendTransactions?.fuse.map(async transfer => {
      const explorerUrl = explorerUrls[fuse.id].blockscout;
      try {
        return constructSendTransaction(
          transfer,
          LayerZeroTransactionStatus.DELIVERED,
          explorerUrl,
        );
      } catch (error: any) {
        console.error('Failed to fetch Fuse send transaction:', error);
        return constructSendTransaction(transfer, LayerZeroTransactionStatus.FAILED, explorerUrl);
      }
    }) || []),
    ...(sendTransactions?.ethereum.map(async transfer => {
      const explorerUrl = explorerUrls[mainnet.id].etherscan;
      try {
        return constructSendTransaction(
          transfer,
          LayerZeroTransactionStatus.DELIVERED,
          explorerUrl,
        );
      } catch (error: any) {
        console.error('Failed to fetch Ethereum send transaction:', error);
        return constructSendTransaction(transfer, LayerZeroTransactionStatus.FAILED, explorerUrl);
      }
    }) || []),
  ];

  const depositTransactionPromises = depositTransactions?.map(async transaction => {
    return constructDepositTransaction(transaction);
  });

  const bridgeDepositTransactionPromises = bridgeDepositTransactions?.map(async transaction => {
    return constructBridgeDepositTransaction(transaction);
  });

  const bankTransferTransactionPromises =
    bankTransfers?.map(async t => {
      return {
        title: 'Bank transfer',
        shortTitle: 'Bank transfer',
        timestamp: t.timestamp.toString(),
        amount: t.amount,
        symbol: t.currency,
        status: mapToTransactionStatus(t.status),
        type: TransactionType.BANK_TRANSFER,
        url: t.url,
        sourceDepositInstructions: t.sourceDepositInstructions,
      };
    }) || [];

  const allPromises: Promise<Transaction | undefined>[] = [
    ...(unsponsorDepositTransactionPromises || []),
    ...(bridgeTransactionPromises || []),
    ...(withdrawTransactionPromises || []),
    ...(sendTransactionPromises || []),
    ...(bridgeDepositTransactionPromises || []),
    ...(depositTransactionPromises || []),
    ...bankTransferTransactionPromises,
  ] as unknown as Promise<Transaction | undefined>[];

  const results = await Promise.allSettled(allPromises);

  const formattedTransactions: Transaction[] = results.reduce((acc: Transaction[], r) => {
    if (r.status === 'fulfilled' && r.value) {
      acc.push(r.value);
    }
    return acc;
  }, []);

  // Sort by timestamp (newest first)
  return formattedTransactions.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
};

export const isDepositedQueryOptions = (safeAddress: string) => {
  return {
    queryKey: [ANALYTICS, 'isDeposited', safeAddress],
    queryFn: async () => {
      const { data } = await infoClient.query<GetUserTransactionsQuery>({
        query: GetUserTransactionsDocument,
        variables: {
          address: safeAddress,
        },
      });

      return data?.deposits?.length ?? 0;
    },
    enabled: !!safeAddress,
  };
};

export const fetchIsDeposited = (queryClient: QueryClient, safeAddress: string) => {
  return queryClient.fetchQuery(isDepositedQueryOptions(safeAddress));
};

export const useTVL = () => {
  return useQuery({
    queryKey: [ANALYTICS, 'tvl'],
    queryFn: fetchTVL,
  });
};

export const useVaultBreakdown = () => {
  return useQuery({
    queryKey: [ANALYTICS, 'vaultBreakdown'],
    queryFn: async () => {
      const vaultBreakdown = await fetchVaultBreakdown();
      return formatVaultBreakdown(vaultBreakdown);
    },
  });
};

export const useAPYs = () => {
  return useQuery({
    queryKey: [ANALYTICS, 'apys'],
    queryFn: fetchAPYs,
  });
};

export const useMaxAPY = () => {
  const { data: apys, isLoading: isAPYsLoading } = useAPYs();
  const thirtyDay = apys?.thirtyDay ?? 0;
  const fifteenDay = apys?.fifteenDay ?? 0;
  const sevenDay = apys?.sevenDay ?? 0;

  const maxThirtyFifteen = Math.max(thirtyDay, fifteenDay);

  // If both thirtyDay and fifteenDay are below 9% and sevenDay is greater than both, use sevenDay
  const shouldUseSevenDay = thirtyDay < 9 && fifteenDay < 9 && sevenDay > maxThirtyFifteen;

  const maxAPY = shouldUseSevenDay ? sevenDay : maxThirtyFifteen;
  const maxAPYDays = shouldUseSevenDay
    ? ApyToDays.sevenDay
    : thirtyDay > fifteenDay
      ? ApyToDays.thirtyDay
      : ApyToDays.fifteenDay;

  return {
    maxAPY,
    maxAPYDays,
    isAPYsLoading,
  };
};

export const formatVaultBreakdown = (vaultBreakdown: VaultBreakdown[]): VaultBreakdown[] => {
  return vaultBreakdown.map(vault => ({
    name: vault.name,
    type: vault.type,
    expiryDate: vault.expiryDate,
    amountUSD: vault.amountUSD,
    allocation: vault.allocation,
    effectivePositionAPY: vault.effectivePositionAPY < 0 ? 0 : vault.effectivePositionAPY,
    positionMaxAPY: vault.positionMaxAPY < 0 ? 0 : vault.positionMaxAPY,
    risk: vault.risk,
    chain: vault.chain,
  }));
};

export const useSearchCoinHistoricalChart = (query: string, days: string = '1') => {
  return useQuery({
    queryKey: [ANALYTICS, 'coinHistoricalChart', query, days],
    queryFn: async () => {
      const searchedCoin = await searchCoin(query);
      const coin = searchedCoin.coins[0];
      return fetchCoinHistoricalChart(coin.id, days);
    },
    enabled: !!query,
  });
};

export const useHistoricalAPY = (days: string = '30') => {
  return useQuery({
    queryKey: [ANALYTICS, 'historicalAPY', days],
    queryFn: async () => {
      return fetchHistoricalAPY(days);
    },
  });
};
