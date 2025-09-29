import { MerklApi } from '@merkl/api'
import { SmartAccountClient } from 'permissionless'
import { Chain, encodeFunctionData } from 'viem'

import MerklDistributorABI from '@/lib/abis/MerklDistributor'
import { ADDRESSES, EXPO_PUBLIC_MERKL_CAMPAIGN_ID } from '@/lib/config'
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute'

export const getMerklRewards = async (address: string, chainId: number) => {
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
        if (breakdown.campaignId === EXPO_PUBLIC_MERKL_CAMPAIGN_ID) {
          rewardsData.push(reward)
        }
      }
    }
  }

  return rewardsData
}

export const claimMerklRewards = async (smartAccountClient: SmartAccountClient, chain: Chain) => {
  if (!smartAccountClient.account?.address) throw 'Smart account address not found'

  const rewards = await getMerklRewards(smartAccountClient.account.address, chain.id)

  const users: string[] = []
  const tokens: string[] = []
  const amounts: bigint[] = []
  const proofs: `0x${string}`[][] = []

  for (const reward of rewards) {
    users.push(smartAccountClient.account.address)
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

  const transaction = await executeTransactions(
    smartAccountClient,
    transactions,
    'Failed to claim Merkl rewards',
    chain,
  )

  if(transaction === USER_CANCELLED_TRANSACTION) {
    throw new Error('User cancelled transaction')
  }

  return transaction
}
