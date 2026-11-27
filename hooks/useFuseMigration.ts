import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Address, erc20Abi, formatUnits } from 'viem';
import { fuse } from 'viem/chains';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivityActions } from '@/hooks/useActivityActions';
import { useBalances } from '@/hooks/useBalances';
import { useCardProvider } from '@/hooks/useCardProvider';
import { CARD_SPENDABLE_QUERY_KEY } from '@/hooks/useCardSpendable';
import { useEuroSpendEnablement } from '@/hooks/useEuroSpendEnablement';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { createDirectDepositSession } from '@/lib/api';
import { getUserErrorMessage, sanitizeTechnicalMessage } from '@/lib/errors';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import {
  buildFuseMigrationBatches,
  buildFuseMigrationItems,
  followVaultDeliveries,
  formatMigrationAmount,
  FuseMigrationAsset,
  FuseMigrationBatch,
  FuseMigrationItem,
  getFuseMigrationAssets,
  MIN_FUSE_MIGRATION_USD,
  movableFuseMigrationItems,
  movableFuseMigrationUsd,
} from '@/lib/fuseMigration';
import { readSponsoredMinimum } from '@/lib/sponsoredMinimum';
import { CardProvider, TransactionStatus, TransactionType } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { generateId } from '@/lib/utils/generate-id';
import { getLayerZeroTransaction } from '@/lib/utils/layerzero';
import { publicClient } from '@/lib/wagmi';
import { whileAccountSelected } from '@/lib/whileAccountSelected';
import { selectSelectedUser, useUserStore } from '@/store/useUserStore';

export const FUSE_MIGRATION_QUERY_KEY = 'fuseMigration';

/** The selected account, as the API client resolves it for each request. */
const SELECTED_ACCOUNT = {
  selectedId: () => selectSelectedUser(useUserStore.getState())?.userId,
  subscribe: (listener: () => void) => useUserStore.subscribe(listener),
};

type FuseMigrationReads = {
  balances: bigint[];
  /** By lowercased teller. A teller whose minimum could not be read is absent. */
  minimums: Record<string, bigint>;
};

/** One retry: a failed read keeps that vault out of the operation, so it is worth a second try. */
const readMinimum = (teller: Address) =>
  readSponsoredMinimum(teller).catch(() => readSponsoredMinimum(teller));

/**
 * The Safe's own balance of each asset on Fuse, read from the chain, with the paymaster's minimum
 * for each vault teller.
 *
 * `balanceOf(safe)` is deliberately the source: collateral the Credit module has locked sits in
 * the module (`collateralOf`), not in the Safe, so what this returns is exactly the balance that
 * is free to move.
 *
 * A minimum that cannot be read is left out rather than taken as zero: a vault below its real
 * minimum would make the paymaster revert, and the bundler would then reject the whole operation,
 * stablecoin transfer included. That vault waits for a read that succeeds.
 */
const readFuseMigration = async (
  safe: Address,
  assets: FuseMigrationAsset[],
): Promise<FuseMigrationReads> => {
  const client = publicClient(fuse.id);
  const balances = await client.multicall({
    allowFailure: false,
    contracts: assets.map(asset => ({
      address: asset.token,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [safe] as const,
    })),
  });

  const tellers = assets.flatMap(asset => (asset.teller ? [asset.teller] : []));
  const reads = await Promise.allSettled(tellers.map(readMinimum));
  const minimums = Object.fromEntries(
    tellers.flatMap((teller, index) => {
      const read = reads[index];
      return read.status === 'fulfilled' ? [[teller.toLowerCase(), read.value] as const] : [];
    }),
  );

  return { balances: balances as bigint[], minimums };
};

/**
 * `partial`: the first Fuse operation landed and a later one was declined, so part of the balance
 * is still on Fuse.
 */
export type FuseMigrationOutcome = 'migrated' | 'partial' | 'cancelled';

/**
 * Everything the card pane needs for the Fuse-to-Base migration: what is on Fuse, whether to ask,
 * and the one-tap move.
 *
 * Offered to a Wirex cardholder whose free Fuse balance in USDC, USDT, soUSD and soETH is worth at
 * least {@link MIN_FUSE_MIGRATION_USD}, while the backend's Base deployment is not switched off.
 *
 * `migrate` turns Base on first when this cardholder never did — so nothing is moved to a chain
 * the card cannot spend from yet — then moves every movable asset in one Fuse user operation. A
 * cardholder without Base therefore approves twice: once on Base, once on Fuse.
 */
export const useFuseMigration = () => {
  const { user, safeAA } = useUser();
  const { provider } = useCardProvider();
  const euroSpend = useEuroSpendEnablement();
  const { tokens } = useBalances();
  const { createActivity, updateActivity, trackTransaction } = useActivityActions();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const [partialNotice, setPartialNotice] = useState<string>();
  // Whether any Fuse operation of the current attempt has landed, for the error path's refresh.
  const confirmedRef = useRef(false);
  const refreshBalances = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [FUSE_MIGRATION_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: ['tokenBalances'] });
    void queryClient.invalidateQueries({ queryKey: [CARD_SPENDABLE_QUERY_KEY] });
  }, [queryClient]);

  const assets = useMemo(() => getFuseMigrationAssets(), []);
  const safe = user?.safeAddress as Address | undefined;
  // Only an explicit `false` is the backend's kill switch; a deployment not yet read is not.
  const baseAvailable = euroSpend.deployment?.available !== false;
  const isWirex = provider === CardProvider.WIREX;

  const query = useQuery({
    queryKey: [FUSE_MIGRATION_QUERY_KEY, safe],
    queryFn: () => readFuseMigration(safe as Address, assets),
    enabled: isWirex && !!safe && baseAvailable,
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  // Vault share prices from the balances already on screen. Stablecoins default to $1.
  const prices = useMemo(() => {
    const byAddress = new Map(
      (tokens ?? [])
        .filter(token => token.chainId === fuse.id)
        .map(token => [token.contractAddress.toLowerCase(), token.quoteRate]),
    );
    return Object.fromEntries(
      assets.map(asset => [asset.symbol, byAddress.get(asset.token.toLowerCase()) || undefined]),
    ) as Record<string, number | undefined>;
  }, [tokens, assets]);

  const items = useMemo(
    () =>
      query.data
        ? buildFuseMigrationItems(assets, query.data.balances, query.data.minimums, prices)
        : [],
    [assets, query.data, prices],
  );
  const movableUsd = movableFuseMigrationUsd(items);
  const isEligible = isWirex && baseAvailable && movableUsd >= MIN_FUSE_MIGRATION_USD;

  const mutation = useMutation({
    mutationFn: async (): Promise<FuseMigrationOutcome> => {
      if (!user?.suborgId || !user?.signWith || !user?.safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }

      // Base first: shares and stablecoins landing on a Base Safe the card is not registered on
      // would be exactly as unspendable as they are on Fuse today.
      if (!euroSpend.isEnabled) {
        const enabled = await euroSpend.enableAsync('fuse_migration');
        if (!enabled) return 'cancelled';
      }

      // Re-read right before building: the figures on screen can be a minute old, and an approve
      // or transfer above the balance reverts the whole operation.
      const fresh = await readFuseMigration(user.safeAddress as Address, assets);
      const toMove = movableFuseMigrationItems(
        buildFuseMigrationItems(assets, fresh.balances, fresh.minimums, prices),
      );
      if (toMove.length === 0) {
        throw new Error('There is nothing left on Fuse to move.');
      }

      const needsDepositAddress = toMove.some(item => item.route === 'deposit_address');
      // The session request authenticates as whichever account is selected when it is sent, and
      // the address it returns receives this Safe's USDC/USDT. Bind it to the migrating account:
      // a switch at any point while it runs fails the attempt before anything is signed.
      const depositAddress = needsDepositAddress
        ? ((
            await whileAccountSelected(user.userId, SELECTED_ACCOUNT, () =>
              withRefreshToken(() => createDirectDepositSession(fuse.id, 'USDC', 'WALLET')),
            )
          )?.walletAddress as Address | undefined)
        : undefined;
      if (needsDepositAddress && !depositAddress) {
        throw new Error('Could not get your deposit address. Please try again.');
      }

      const baseSafeAddress = (euroSpend.deployment?.safeAddress ?? user.safeAddress) as Address;
      const batches = buildFuseMigrationBatches({ items: toMove, baseSafeAddress, depositAddress });

      track(TRACKING_EVENTS.FUSE_MIGRATION_STARTED, {
        usd: movableFuseMigrationUsd(toMove),
        assets: toMove.map(item => item.symbol),
        base_enabled_before: euroSpend.isEnabled,
        operations: batches.length,
      });

      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

      // USDC and USDT get their activity rows from the backend, which sees them arrive at the
      // deposit address and delivers them. Vault shares bridge straight from the Safe, so those
      // rows are written here: the first tracks the operation, any second one joins it on success.
      const activityFor = (item: FuseMigrationItem) => ({
        clientTxId: generateId(),
        type: TransactionType.BRIDGE,
        title: `Move ${formatMigrationAmount(item)} ${item.symbol} to Base`,
        shortTitle: 'Move to Base',
        amount: formatUnits(item.amount, item.decimals),
        symbol: item.symbol,
        chainId: fuse.id,
        fromAddress: user.safeAddress,
        toAddress: baseSafeAddress,
        metadata: {
          description: `Move ${item.symbol} from Fuse to Base`,
          tokenAddress: item.token,
          migration: 'fuse_to_base',
        },
      });

      const sendBatch = async (batch: FuseMigrationBatch) => {
        const execute = (onUserOpHash?: (hash: `0x${string}`) => void) =>
          executeTransactions(
            smartAccountClient,
            batch.calls,
            'Could not move your funds to Base',
            fuse,
            onUserOpHash,
          );

        const [firstVault, ...otherVaults] = batch.items.filter(
          item => item.route === 'vault_bridge',
        );
        const firstActivity = firstVault ? activityFor(firstVault) : undefined;
        const result = firstActivity
          ? await trackTransaction(firstActivity, onUserOpHash => execute(onUserOpHash))
          : await execute();
        if (result === USER_CANCELLED_TRANSACTION) return undefined;

        const txHash = result.transactionHash;
        // Each vault's row, with the teller its LayerZero message is sent from.
        const vaultActivities: { id: string; teller?: Address }[] =
          firstActivity && firstVault
            ? [{ id: firstActivity.clientTxId, teller: firstVault.teller }]
            : [];
        for (const item of otherVaults) {
          const activity = activityFor(item);
          vaultActivities.push({
            id: await createActivity({
              ...activity,
              status: TransactionStatus.PROCESSING,
              metadata: { ...activity.metadata, txHash },
            }),
            teller: item.teller,
          });
        }

        // The Fuse receipt only says the shares left. Each row is marked done once its own
        // LayerZero message is delivered; a row whose message never is stays processing rather
        // than claim a delivery not seen.
        if (vaultActivities.length && txHash) {
          void followVaultDeliveries({
            activities: vaultActivities,
            fetchMessages: async () => (await getLayerZeroTransaction(txHash)).data,
            onDelivered: id =>
              updateActivity(id, {
                status: TransactionStatus.SUCCESS,
                metadata: { layerzeroDeliveredAt: new Date().toISOString() },
              }),
          }).catch(() => undefined);
        }
        return txHash;
      };

      confirmedRef.current = false;
      // One after another, each waiting for the last to land, so every operation reads the
      // nonce the previous one left. See buildFuseMigrationBatches for why there can be two.
      const txHashes: string[] = [];
      for (const batch of batches) {
        const txHash = await sendBatch(batch);
        if (!txHash) {
          track(TRACKING_EVENTS.FUSE_MIGRATION_CANCELLED, {
            step: 'fuse',
            operation: txHashes.length + 1,
            operations: batches.length,
          });
          if (txHashes.length === 0) return 'cancelled';
          // The first operation landed; what the declined one held is still on Fuse, and the
          // banner keeps offering it.
          setPartialNotice(
            `${batch.items.map(item => item.symbol).join(' and ')} is still on Fuse. Tap Migrate to move it.`,
          );
          return 'partial';
        }
        txHashes.push(txHash);
        confirmedRef.current = true;
      }

      track(TRACKING_EVENTS.FUSE_MIGRATION_COMPLETED, {
        usd: movableFuseMigrationUsd(toMove),
        assets: toMove.map(item => item.symbol),
        transaction_hashes: txHashes,
      });
      return 'migrated';
    },
    onSuccess: outcome => {
      if (outcome !== 'cancelled') refreshBalances();
    },
    onError: (mutationError: Error) => {
      // A later operation failed after an earlier one landed: what moved must not stay on offer.
      if (confirmedRef.current) refreshBalances();
      setError(getUserErrorMessage(mutationError, { action: 'bridge' }) || undefined);
      track(TRACKING_EVENTS.FUSE_MIGRATION_FAILED, {
        error: sanitizeTechnicalMessage(mutationError) || 'unknown',
      });
    },
  });

  const { mutateAsync } = mutation;
  const migrate = useCallback(async (): Promise<FuseMigrationOutcome | undefined> => {
    setError(undefined);
    setPartialNotice(undefined);
    try {
      return await mutateAsync();
    } catch {
      // Reported through `error`.
      return undefined;
    }
  }, [mutateAsync]);

  return {
    items,
    movableUsd,
    isEligible,
    isLoading: query.isLoading,
    /** Whether the move will turn Base on first, so the sheet can say there are two approvals. */
    needsBaseEnable: !euroSpend.isEnabled,
    isMigrating: mutation.isPending,
    isEnablingBase: euroSpend.isEnabling,
    error: error ?? euroSpend.error ?? partialNotice,
    clearError: useCallback(() => {
      setError(undefined);
      setPartialNotice(undefined);
      euroSpend.clearError();
    }, [euroSpend]),
    migrate,
  };
};
