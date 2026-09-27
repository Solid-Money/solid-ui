import { decodeFunctionData } from 'viem';
import { fuse, mainnet } from 'viem/chains';

import MerklDistributorABI from '@/lib/abis/MerklDistributor';
import { wNativeABI } from '@/lib/abis/tokens';
import { ADDRESSES } from '@/lib/config';
import {
  buildYieldBoostClaimTransactions,
  EMPTY_YIELD_BOOST_REWARDS,
  parseMerklYieldBoostRewards,
  YIELD_BOOST_REWARD_TOKEN,
  yieldBoostClaimPayout,
} from '@/lib/merklYieldBoost';

const SAFE = '0x1111111111111111111111111111111111111111';
const BOOST_USD = '0xaaaa';
const BOOST_ETH = '0xbbbb';
const OTHER = '0xcccc';
const PROOF = `0x${'ab'.repeat(32)}` as const;

const wfuseReward = (overrides: Record<string, unknown> = {}) => ({
  amount: '5000',
  claimed: '1000',
  pending: '300',
  proofs: [PROOF],
  token: { address: YIELD_BOOST_REWARD_TOKEN.toLowerCase(), price: 0.02 },
  breakdowns: [
    { campaignId: BOOST_USD, amount: '3000', pending: '200' },
    { campaignId: BOOST_ETH.toUpperCase().replace('0X', '0x'), amount: '1500', pending: '100' },
    { campaignId: OTHER, amount: '500', pending: '0' },
  ],
  ...overrides,
});

const response = (rewards: unknown[], chainId: number = fuse.id) => [
  { chain: { id: chainId }, rewards },
];

describe('parseMerklYieldBoostRewards', () => {
  it('reads the WFUSE leaf on Fuse', () => {
    const parsed = parseMerklYieldBoostRewards(response([wfuseReward()]), []);

    expect(parsed).toEqual({
      amount: 5000n,
      claimed: 1000n,
      claimable: 4000n,
      earned: 5300n,
      proofs: [PROOF],
      priceUsd: 0.02,
    });
  });

  it('scopes earned to the boost campaigns, whatever their case', () => {
    const parsed = parseMerklYieldBoostRewards(response([wfuseReward()]), [BOOST_USD, BOOST_ETH]);

    // 3000 + 200 + 1500 + 100 — the unrelated campaign's 500 is left out.
    expect(parsed.earned).toBe(4800n);
    // Claims are per token, so what can be claimed is never scoped.
    expect(parsed.claimable).toBe(4000n);
  });

  it('ignores other tokens and other chains', () => {
    const otherToken = wfuseReward({
      token: { address: '0x28C3d1cD466Ba22f6cae51b1a4692a831696391A' },
    });

    expect(parseMerklYieldBoostRewards(response([otherToken]), [])).toBe(EMPTY_YIELD_BOOST_REWARDS);
    expect(parseMerklYieldBoostRewards(response([wfuseReward()], mainnet.id), [])).toBe(
      EMPTY_YIELD_BOOST_REWARDS,
    );
  });

  it('never reports a negative claimable', () => {
    const parsed = parseMerklYieldBoostRewards(
      response([wfuseReward({ amount: '1000', claimed: '1000' })]),
      [],
    );

    expect(parsed.claimable).toBe(0n);
  });

  it('survives malformed payloads', () => {
    expect(parseMerklYieldBoostRewards(null, [])).toBe(EMPTY_YIELD_BOOST_REWARDS);
    expect(parseMerklYieldBoostRewards({ error: 'x' }, [])).toBe(EMPTY_YIELD_BOOST_REWARDS);

    const parsed = parseMerklYieldBoostRewards(
      response([
        wfuseReward({
          amount: 'NaN',
          claimed: undefined,
          token: { address: YIELD_BOOST_REWARD_TOKEN },
        }),
      ]),
      [],
    );
    expect(parsed.amount).toBe(0n);
    expect(parsed.priceUsd).toBeNull();
  });
});

describe('buildYieldBoostClaimTransactions', () => {
  const rewards = { amount: 5000n, proofs: [PROOF] };

  it('claims the cumulative amount and unwraps exactly what it pays', () => {
    const [claim, unwrap] = buildYieldBoostClaimTransactions({
      safeAddress: SAFE,
      rewards,
      claimedOnchain: 1200n,
    });

    expect(claim.to).toBe(ADDRESSES.fuse.merklDistributor);
    expect(decodeFunctionData({ abi: MerklDistributorABI, data: claim.data })).toEqual({
      functionName: 'claim',
      args: [[SAFE], [YIELD_BOOST_REWARD_TOKEN], [5000n], [[PROOF]]],
    });

    expect(unwrap.to).toBe(YIELD_BOOST_REWARD_TOKEN);
    expect(decodeFunctionData({ abi: wNativeABI, data: unwrap.data })).toEqual({
      functionName: 'withdraw',
      args: [3800n],
    });
  });

  it('builds nothing when everything is already claimed', () => {
    expect(
      buildYieldBoostClaimTransactions({ safeAddress: SAFE, rewards, claimedOnchain: 5000n }),
    ).toEqual([]);
  });

  it('builds nothing without proofs', () => {
    expect(
      buildYieldBoostClaimTransactions({
        safeAddress: SAFE,
        rewards: { amount: 5000n, proofs: [] },
        claimedOnchain: 0n,
      }),
    ).toEqual([]);
  });
});

describe('yieldBoostClaimPayout', () => {
  it('is the unclaimed remainder, floored at zero', () => {
    expect(yieldBoostClaimPayout(5000n, 1000n)).toBe(4000n);
    expect(yieldBoostClaimPayout(1000n, 5000n)).toBe(0n);
  });
});
