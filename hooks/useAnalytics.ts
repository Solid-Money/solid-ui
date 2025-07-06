import { infoClient } from "@/graphql/clients";
import { QueryClient, useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";

import {
  GetUserTransactionsDocument,
  GetUserTransactionsQuery,
} from "@/graphql/generated/user-info";
import {
  fetchLayerZeroBridgeTransactions,
  fetchTokenTransfer,
  fetchTotalAPY,
} from "@/lib/api";
import { LayerZeroTransactionStatus, Transaction, TransactionType } from "@/lib/types";

const ANALYTICS = "analytics";

export const useTotalAPY = () => {
  return useQuery({
    queryKey: [ANALYTICS, "totalAPY"],
    queryFn: fetchTotalAPY,
    refetchOnWindowFocus: false,
  });
};

export const useLatestTokenTransfer = (address: string, token: string) => {
  return useQuery({
    queryKey: [ANALYTICS, "latestTokenTransfer", address, token],
    queryFn: async () => {
      if (!address) return 0;
      const response = await fetchTokenTransfer(address, token);
      const latest = response.items.reduce((prev, curr) =>
        new Date(curr.timestamp) > new Date(prev.timestamp) ? curr : prev
      );
      return new Date(latest.timestamp).getTime();
    },
    enabled: !!address,
    refetchOnWindowFocus: false,
  });
};

export const formatTransactions = async (
  transactions: GetUserTransactionsQuery | undefined
): Promise<Transaction[]> => {
  if (!transactions?.deposits?.length) {
    return [];
  }

  const depositTransactionPromises = transactions.deposits.map(
    async (internalTransaction) => {
      try {
        const lzTransactions = await fetchLayerZeroBridgeTransactions(
          internalTransaction.transactionHash
        );

        const status =
          lzTransactions?.data?.[0]?.status?.name ||
          LayerZeroTransactionStatus.INFLIGHT;

        return {
          title: "Deposit USDC",
          timestamp: internalTransaction.depositTimestamp,
          amount: Number(
            formatUnits(BigInt(internalTransaction.depositAmount), 6)
          ),
          status,
          hash: internalTransaction.transactionHash,
          type: TransactionType.DEPOSIT,
        };
      } catch (error: any) {
        console.error("Failed to fetch LZ transaction:", error);
        return {
          title: "Deposit USDC",
          timestamp: internalTransaction.depositTimestamp,
          amount: Number(
            formatUnits(BigInt(internalTransaction.depositAmount), 6)
          ),
          status:
            error.response.status === 404
              ? LayerZeroTransactionStatus.INFLIGHT
              : LayerZeroTransactionStatus.FAILED,
          hash: internalTransaction.transactionHash,
          type: TransactionType.DEPOSIT,
        };
      }
    }
  );

  const bridgeTransactionPromises = transactions.bridges.map(
    async (internalTransaction) => {
      try {
        const lzTransactions = await fetchLayerZeroBridgeTransactions(
          internalTransaction.transactionHash
        );

        const status =
          lzTransactions?.data?.[0]?.status?.name ||
          LayerZeroTransactionStatus.INFLIGHT;

        return {
          title: "Bridge soUSD",
          timestamp: internalTransaction.blockTimestamp,
          amount: Number(
            formatUnits(BigInt(internalTransaction.shareAmount), 6)
          ),
          status,
          hash: internalTransaction.transactionHash,
          type: TransactionType.BRIDGE,
        };
      } catch (error: any) {
        console.error("Failed to fetch LZ transaction:", error);
        return {
          title: "Bridge soUSD",
          timestamp: internalTransaction.blockTimestamp,
          amount: Number(
            formatUnits(BigInt(internalTransaction.shareAmount), 6)
          ),
          status:
            error.response.status === 404
              ? LayerZeroTransactionStatus.INFLIGHT
              : LayerZeroTransactionStatus.FAILED,
          hash: internalTransaction.transactionHash,
          type: TransactionType.BRIDGE,
        };
      }
    }
  );

  const withdrawTransactionPromises = transactions.withdraws.map(
    async (internalTransaction) => {
      return {
        title: "Withdraw soUSD",
        timestamp: internalTransaction.creationTime,
        amount: Number(
          formatUnits(BigInt(internalTransaction.amountOfAssets), 6)
        ),
        status:
          internalTransaction.requestStatus === "SOLVED"
            ? LayerZeroTransactionStatus.DELIVERED
            : internalTransaction.requestStatus === "CANCELLED"
              ? LayerZeroTransactionStatus.FAILED
              : LayerZeroTransactionStatus.INFLIGHT,
        hash:
          internalTransaction.requestStatus === "SOLVED"
            ? internalTransaction.solveTxHash
            : internalTransaction.requestTxHash,
        type: TransactionType.WITHDRAW,
      };
    }
  );

  const formattedTransactions = await Promise.all([
    ...depositTransactionPromises,
    ...bridgeTransactionPromises,
    ...withdrawTransactionPromises,
  ]);

  // Sort by timestamp (newest first)
  return formattedTransactions.sort((a, b) => b.timestamp - a.timestamp);
};

export const isDepositedQueryOptions = (safeAddress: string) => {
  return {
    queryKey: [ANALYTICS, "isDeposited", safeAddress],
    queryFn: async () => {
      const { data } = await infoClient.query({
        query: GetUserTransactionsDocument,
        variables: {
          address: safeAddress,
        },
      });

      return data?.deposits?.length;
    },
    enabled: !!safeAddress,
    refetchOnWindowFocus: false,
  };
};

export const fetchIsDeposited = (
  queryClient: QueryClient,
  safeAddress: string
) => {
  return queryClient.fetchQuery(isDepositedQueryOptions(safeAddress));
};
