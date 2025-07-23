import { infoClient } from "@/graphql/clients";
import { QueryClient, useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { fuse, mainnet } from "viem/chains";

import {
  GetUserTransactionsDocument,
  GetUserTransactionsQuery,
} from "@/graphql/generated/user-info";
import {
  fetchLayerZeroBridgeTransactions,
  fetchTokenTransfer,
  fetchTotalAPY,
} from "@/lib/api";
import { BlockscoutTransaction, BlockscoutTransactions, LayerZeroTransactionStatus, Transaction, TransactionType } from "@/lib/types";
import { explorerUrls, layerzero } from "@/constants/explorers";

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
      const response = await fetchTokenTransfer({ address, token });
      const latest = response.items.reduce((prev, curr) =>
        new Date(curr.timestamp) > new Date(prev.timestamp) ? curr : prev
      );
      return new Date(latest.timestamp).getTime();
    },
    enabled: !!address,
    refetchOnWindowFocus: false,
  });
};

const filterTransfers = (transfers: BlockscoutTransactions) => {
  return transfers.items.filter((transfer) => {
    const name = transfer.to.name
    const isSafe = name?.toLowerCase().includes("safe")
    const isTokenTransfer = transfer.type === "token_transfer"

    if ((!name || isSafe) && isTokenTransfer) {
      return transfer
    }
  })
}

export const useSendTransactions = (address: string) => {
  return useQuery({
    queryKey: [ANALYTICS, "sendTransactions", address],
    queryFn: async () => {
      const fuseTransfers = await fetchTokenTransfer({
        address,
        filter: "from",
      });

      const ethereumTransfers = await fetchTokenTransfer({
        address,
        filter: "from",
        explorerUrl: explorerUrls[mainnet.id].blockscout,
      });

      const filteredFuseTransfers = filterTransfers(fuseTransfers)
      const filteredEthereumTransfers = filterTransfers(ethereumTransfers)

      return {
        fuse: filteredFuseTransfers,
        ethereum: filteredEthereumTransfers,
      }
    },
    enabled: !!address,
    refetchOnWindowFocus: false,
  })
}

const constructSendTransaction = (
  transfer: BlockscoutTransaction,
  status: LayerZeroTransactionStatus,
  explorerUrl?: string
) => {
  const hash = transfer.transaction_hash;
  const symbol = transfer.token.symbol;

  return {
    title: `Send ${symbol}`,
    timestamp: (new Date(transfer.timestamp).getTime() / 1000).toString(),
    amount: Number(formatUnits(BigInt(transfer.total.value), Number(transfer.total.decimals))),
    symbol,
    status,
    hash,
    url: `${explorerUrl}/tx/${hash}`,
    type: TransactionType.SEND,
    logoUrl: transfer.token.icon_url,
  }
}

export const formatTransactions = async (
  transactions: GetUserTransactionsQuery | undefined,
  sendTransactions: {
    fuse: BlockscoutTransaction[],
    ethereum: BlockscoutTransaction[],
  } | undefined,
): Promise<Transaction[]> => {
  if (!transactions?.deposits?.length) {
    return [];
  }

  const depositTransactionPromises = transactions.deposits.map(
    async (internalTransaction) => {
      const hash = internalTransaction.transactionHash;
      try {
        const lzTransactions = await fetchLayerZeroBridgeTransactions(hash);

        const status =
          lzTransactions?.data?.[0]?.status?.name ||
          LayerZeroTransactionStatus.INFLIGHT;

        return {
          title: "Deposit USDC",
          timestamp: internalTransaction.depositTimestamp,
          amount: Number(
            formatUnits(BigInt(internalTransaction.depositAmount), 6)
          ),
          symbol: "USDC",
          status,
          hash,
          url: `${explorerUrls[layerzero.id].layerzeroscan}/tx/${hash}`,
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
          symbol: "USDC",
          status:
            error.response.status === 404
              ? LayerZeroTransactionStatus.INFLIGHT
              : LayerZeroTransactionStatus.FAILED,
          hash,
          url: `${explorerUrls[layerzero.id].layerzeroscan}/tx/${hash}`,
          type: TransactionType.DEPOSIT,
        };
      }
    }
  );

  const bridgeTransactionPromises = transactions.bridges.map(
    async (internalTransaction) => {
      const hash = internalTransaction.transactionHash;
      try {
        const lzTransactions = await fetchLayerZeroBridgeTransactions(hash);

        const status =
          lzTransactions?.data?.[0]?.status?.name ||
          LayerZeroTransactionStatus.INFLIGHT;

        return {
          title: "Unstake soUSD",
          timestamp: internalTransaction.blockTimestamp,
          amount: Number(
            formatUnits(BigInt(internalTransaction.shareAmount), 6)
          ),
          symbol: "soUSD",
          status,
          hash,
          url: `${explorerUrls[layerzero.id].layerzeroscan}/tx/${hash}`,
          type: TransactionType.UNSTAKE,
        };
      } catch (error: any) {
        console.error("Failed to fetch LZ transaction:", error);
        return {
          title: "Unstake soUSD",
          timestamp: internalTransaction.blockTimestamp,
          amount: Number(
            formatUnits(BigInt(internalTransaction.shareAmount), 6)
          ),
          symbol: "soUSD",
          status:
            error.response.status === 404
              ? LayerZeroTransactionStatus.INFLIGHT
              : LayerZeroTransactionStatus.FAILED,
          hash,
          url: `${explorerUrls[layerzero.id].layerzeroscan}/tx/${hash}`,
          type: TransactionType.UNSTAKE,
        };
      }
    }
  );

  const withdrawTransactionPromises = transactions.withdraws.map(
    async (internalTransaction) => {
      const hash = internalTransaction.requestStatus === "SOLVED"
        ? internalTransaction.solveTxHash
        : internalTransaction.requestTxHash;

      return {
        title: "Withdraw soUSD",
        timestamp: internalTransaction.creationTime,
        amount: Number(
          formatUnits(BigInt(internalTransaction.amountOfAssets), 6)
        ),
        symbol: "soUSD",
        status:
          internalTransaction.requestStatus === "SOLVED"
            ? LayerZeroTransactionStatus.DELIVERED
            : internalTransaction.requestStatus === "CANCELLED"
              ? LayerZeroTransactionStatus.FAILED
              : LayerZeroTransactionStatus.INFLIGHT,
        hash,
        url: `${explorerUrls[mainnet.id].etherscan}/tx/${hash}`,
        type: TransactionType.WITHDRAW,
      };
    }
  );

  const sendTransactionPromises = [
    ...(sendTransactions?.fuse.map(
      async (transfer) => {
        const explorerUrl = explorerUrls[fuse.id].blockscout
        try {
          return constructSendTransaction(transfer, LayerZeroTransactionStatus.DELIVERED, explorerUrl)
        } catch (error: any) {
          console.error("Failed to fetch Fuse send transaction:", error);
          return constructSendTransaction(transfer, LayerZeroTransactionStatus.FAILED, explorerUrl)
        }
      }
    ) || []),
    ...(sendTransactions?.ethereum.map(
      async (transfer) => {
        const explorerUrl = explorerUrls[mainnet.id].etherscan
        try {
          return constructSendTransaction(transfer, LayerZeroTransactionStatus.DELIVERED, explorerUrl)
        } catch (error: any) {
          console.error("Failed to fetch Ethereum send transaction:", error);
          return constructSendTransaction(transfer, LayerZeroTransactionStatus.FAILED, explorerUrl)
        }
      }
    ) || [])
  ]

  const formattedTransactions = await Promise.all([
    ...depositTransactionPromises,
    ...bridgeTransactionPromises,
    ...withdrawTransactionPromises,
    ...sendTransactionPromises,
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
