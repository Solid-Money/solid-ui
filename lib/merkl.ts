import { MerklApi } from '@merkl/api'
import { SmartAccountClient } from 'permissionless'
import { Chain, encodeFunctionData, formatUnits } from 'viem'
import * as Sentry from '@sentry/react-native';

import MerklDistributorABI from '@/lib/abis/MerklDistributor'
import { ADDRESSES, EXPO_PUBLIC_MERKL_CAMPAIGN_ID } from '@/lib/config'
import { executeTransactions, getTransaction, USER_CANCELLED_TRANSACTION } from '@/lib/execute'
import { TransactionType, TransactionStatus } from '@/lib/types'
import { TrackTransaction } from '@/hooks/useActivity';

export const getMerklRewards = async (
  address: string,
  chainId: number,
  campaignId: string = EXPO_PUBLIC_MERKL_CAMPAIGN_ID
) => {
  const { status, data } = await MerklApi('https://api.merkl.xyz')
    .v4.users({ address })
    .rewards.get({ query: { chainId: [chainId.toString()], breakdownPage: 0 } })

  if (status !== 200) throw 'Failed to fetch Merkl rewards'

  if (!data) throw 'No data received from Merkl API'

  let rewardsData = [];

  for (const d of data) {
    if (d.chain.id !== chainId) continue

    for (const reward of d.rewards) {
      for (const breakdown of reward.breakdowns) {
        if (breakdown.campaignId === campaignId) {
          rewardsData.push(reward)
        }
      }
    }
  }

  return rewardsData
}

export const claimMerklRewards = async (
  smartAccountClient: SmartAccountClient,
  chain: Chain,
  trackTransaction: TrackTransaction,
  campaignId: string = EXPO_PUBLIC_MERKL_CAMPAIGN_ID
) => {
  const safeAddress = smartAccountClient.account?.address
  if (!safeAddress) throw 'Safe address not found'

  const rewards = await getMerklRewards(safeAddress, chain.id, campaignId)

  const users: string[] = []
  const tokens: string[] = []
  const amounts: bigint[] = []
  const proofs: `0x${string}`[][] = []

  for (const reward of rewards) {
    users.push(safeAddress)
    tokens.push(reward.token.address)
    amounts.push(BigInt(reward.amount))
    proofs.push(reward.proofs as `0x${string}`[])
  }

  if (tokens.length === 0) throw 'No tokens to claim Merkl rewards'

  const merklDistributorAddress = ADDRESSES.fuse.merklDistributor

  const transactions = [
    {
      to: merklDistributorAddress,
      data: encodeFunctionData({
        abi: MerklDistributorABI,
        functionName: 'claim',
        args: [users, tokens, amounts, proofs],
      }),
    },
  ]

  const amount = amounts.reduce((acc, amount) => acc + amount, 0n)
  const formattedAmount = formatUnits(amount, 6)
  // Track only successful claim rewards
  const status = TransactionStatus.SUCCESS

  const result = await trackTransaction(
    {
      type: TransactionType.MERKL_CLAIM,
      title: `Claim boosted yield`,
      amount: formattedAmount,
      symbol: 'soUSD',
      chainId: chain.id,
      fromAddress: merklDistributorAddress,
      toAddress: safeAddress,
      status,
      metadata: {
        description: `Claim ${formattedAmount} soUSD from Merkl`,
      },
    },
    (onUserOpHash) => executeTransactions(
      smartAccountClient,
      transactions,
      'Failed to claim Merkl rewards',
      chain,
      onUserOpHash
    )
  );

  const transaction = getTransaction(result)

  if (transaction === USER_CANCELLED_TRANSACTION) {
    const error = new Error('User cancelled transaction');
    Sentry.captureException(error, {
      tags: {
        operation: 'merkl_claim',
        step: 'execution',
        reason: 'user_cancelled',
      },
      extra: {
        amount,
        userAddress: safeAddress,
        chainId: chain.id,
      },
    });
    throw error;
  }

  return transaction
}
