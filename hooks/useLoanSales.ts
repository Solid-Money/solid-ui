import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type Address } from 'viem';
import { base, fuse } from 'viem/chains';

import { useCreditInstanceAddresses } from '@/hooks/useCardCreditPositions';
import { CARD_SPEND_REGISTRATION_QUERY_KEY } from '@/hooks/useCardSpendRegistration';
import useUser from '@/hooks/useUser';
import { SolidCashModuleV2_ABI } from '@/lib/abis/SolidCashModuleV2';
import { publicClient } from '@/lib/wagmi';

/** A sale of locked collateral to cover part of a loan (`Liquidated`). */
export interface LoanSaleEvent {
  chainId: number;
  /** The asset that was sold. */
  token: Address;
  /** Debt it covered, 6-decimal USD. */
  repaidUsd: bigint;
  /** Token units taken, the penalty included. */
  seized: bigint;
  transactionHash: `0x${string}`;
  /** Unix seconds. */
  timestamp: number;
  /**
   * The penalty the sale took, as the token's `liquidationBonusBps` stood at its block. Null when
   * that block's state could not be read: the token's terms today may not be the sale's.
   */
  bonusBps: number | null;
}

/** How far back a sale is still news on the Credit page. */
export const SALE_LOOKBACK_SECONDS = 7 * 24 * 60 * 60;

/** Blocks sampled to measure a chain's block time; block times change (Base went to 0.2s). */
const BLOCK_TIME_SAMPLE = 10_000n;

/** Doublings of the lookback allowed when its start block is still inside the week. */
const MAX_LOOKBACK_STEPS = 4;

/** How often the open Credit page looks for a new sale: nothing else reports one. */
const SALES_REFRESH_MS = 60_000;

/**
 * The sales on one instance in the last week, newest first.
 *
 * `Liquidated` indexes the Safe, so the filter is by topic and the response stays small however
 * many blocks it spans.
 */
const readSales = async (
  chainId: number,
  moduleAddress: Address,
  safe: Address,
): Promise<LoanSaleEvent[]> => {
  const client = publicClient(chainId);
  // The lookback in blocks, from the chain's measured block time rather than an assumed one, with
  // a tenth spare; events are then cut to the week by their own timestamps.
  const head = await client.getBlock({ blockTag: 'latest' });
  const latest = head.number;
  const sampleFrom = latest > BLOCK_TIME_SAMPLE ? latest - BLOCK_TIME_SAMPLE : 0n;
  const sample = await client.getBlock({ blockNumber: sampleFrom });
  const sampledBlocks = Number(latest - sampleFrom);
  const secondsPerBlock =
    sampledBlocks > 0
      ? Math.max(Number(head.timestamp - sample.timestamp) / sampledBlocks, 0.05)
      : 1;
  const since = Number(head.timestamp) - SALE_LOOKBACK_SECONDS;
  // The estimate is only a starting point: blocks may have been slower earlier in the week. Step
  // further back until the start block is at or before the week's start, so no sale is missed;
  // anything older is cut by timestamp below. Usually one read confirms the estimate.
  let span = BigInt(Math.ceil((SALE_LOOKBACK_SECONDS / secondsPerBlock) * 1.1));
  let fromBlock = latest > span ? latest - span : 0n;
  for (let step = 0; step < MAX_LOOKBACK_STEPS && fromBlock > 0n; step += 1) {
    const start = await client.getBlock({ blockNumber: fromBlock });
    if (Number(start.timestamp) <= since) break;
    span *= 2n;
    fromBlock = latest > span ? latest - span : 0n;
  }

  const events = await client.getContractEvents({
    address: moduleAddress,
    abi: SolidCashModuleV2_ABI,
    eventName: 'Liquidated',
    args: { safe },
    fromBlock,
    toBlock: latest,
  });
  if (events.length === 0) return [];

  const blocks = [...new Set(events.map(event => event.blockNumber))];
  const timestamps = new Map(
    await Promise.all(
      blocks.map(
        async blockNumber =>
          [blockNumber, Number((await client.getBlock({ blockNumber })).timestamp)] as const,
      ),
    ),
  );

  // The bonus as configured at each sale's block, one historical read per token and block.
  const bonusKey = (token: Address, blockNumber: bigint) => `${token.toLowerCase()}:${blockNumber}`;
  const bonusReads = [
    ...new Map(
      events.flatMap(event =>
        event.args.collateralToken
          ? [
              [
                bonusKey(event.args.collateralToken, event.blockNumber),
                { token: event.args.collateralToken, blockNumber: event.blockNumber },
              ] as const,
            ]
          : [],
      ),
    ).entries(),
  ];
  const bonuses = new Map(
    await Promise.all(
      bonusReads.map(async ([key, { token, blockNumber }]) => {
        const bonus = await client
          .readContract({
            address: moduleAddress,
            abi: SolidCashModuleV2_ABI,
            functionName: 'getTokenConfig',
            args: [token],
            blockNumber,
          })
          .then(config => Number(config.liquidationBonusBps))
          .catch(() => null);
        return [key, bonus] as const;
      }),
    ),
  );

  return events
    .flatMap(event => {
      const { collateralToken, repaidUsd, collateralSeized } = event.args;
      if (!collateralToken || repaidUsd === undefined || collateralSeized === undefined) return [];
      return [
        {
          chainId,
          token: collateralToken,
          repaidUsd,
          seized: collateralSeized,
          transactionHash: event.transactionHash,
          timestamp: timestamps.get(event.blockNumber) ?? 0,
          bonusBps: bonuses.get(bonusKey(collateralToken, event.blockNumber)) ?? null,
        },
      ];
    })
    .filter(sale => sale.timestamp >= since)
    .sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Recent sales of the cardholder's collateral, per instance.
 *
 * Nothing else tells a cardholder that part of a loan was sold, so the Credit page reads the
 * chain for it. A failed read shows nothing rather than an error: the loan itself still reads
 * correctly, only the note about a past sale is missing.
 */
export const useLoanSales = ({ enabled }: { enabled: boolean }) => {
  const { user } = useUser();
  const safe = user?.safeAddress as Address | undefined;
  const addresses = useCreditInstanceAddresses();

  const query = (chainId: number) => {
    const instance = addresses[chainId];
    return {
      queryKey: [
        CARD_SPEND_REGISTRATION_QUERY_KEY,
        'loan-sales',
        chainId,
        safe,
        instance?.moduleAddress,
      ],
      queryFn: () => readSales(chainId, instance!.moduleAddress!, safe!),
      enabled: enabled && Boolean(instance?.live && instance.moduleAddress && safe),
      staleTime: 60_000,
      refetchInterval: SALES_REFRESH_MS,
      retry: 1,
    };
  };

  const fuseSales = useQuery(query(fuse.id));
  const baseSales = useQuery(query(base.id));

  return useMemo(
    () =>
      ({
        [fuse.id]: fuseSales.data ?? [],
        [base.id]: baseSales.data ?? [],
      }) as Record<number, LoanSaleEvent[]>,
    [fuseSales.data, baseSales.data],
  );
};

export default useLoanSales;
