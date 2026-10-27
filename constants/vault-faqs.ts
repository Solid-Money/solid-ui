import { Faq, VaultType } from '@/lib/types';

/**
 * Per-vault FAQ copy for the vault detail screen.
 *
 * The savings screen used to show one soUSD-centric list on all three vaults,
 * so someone opening the ETH or FUSE vault was told what soUSD is and why they
 * didn't receive 1 soUSD per USDC. Each vault answers for itself here instead.
 *
 * Copy is product-owned (Monday 12943830277) and reproduced verbatim — edit it
 * there, not here. The EUR vault's copy is the exception: it was written with the
 * vault's launch and is not on that board yet.
 */
const VAULT_FAQS: Record<VaultType, Faq[]> = {
  [VaultType.USDC]: [
    {
      question: 'What is soUSD?',
      answer:
        "Your yield-bearing dollar. Deposit USDC or USDT and receive soUSD. Your soUSD count doesn't change, each soUSD becomes worth more over time.",
    },
    {
      question: 'Where does the yield come from?',
      answer:
        'Your deposit is deployed across diversified, blue-chip DeFi lending and fixed-yield strategies (Morpho, Pendle and others), managed under strict risk controls. Allocation is adjusted over time to balance yield and safety.',
    },
    {
      question: 'Can I spend from USD Yield?',
      answer:
        'Yes. soUSD backs your Solid card balance. Your dollars keep earning until the moment you spend them, and you can spend against soUSD without withdrawing it.',
    },
    {
      question: 'Is soUSD a stablecoin?',
      answer:
        "It's a yield-bearing representation of USD. Its value in dollars rises with accrued yield rather than staying fixed at 1.00.",
    },
    {
      question: 'How fast can I withdraw?',
      answer:
        'Withdrawals are processed on demand. Most complete within minutes, with no exit fee or waiting period.',
    },
  ],
  [VaultType.ETH]: [
    {
      question: 'What is soETH?',
      answer:
        'Your yield-bearing ETH. Deposit ETH and receive soETH, which grows in ETH terms as staking rewards and strategy yield accrue.',
    },
    {
      question: 'Where does the yield come from?',
      answer:
        'Your ETH is put to work through liquid staking and a focused set of conservative ETH strategies. The goal is to beat standard liquid staking returns without adding meaningful risk.',
    },
    {
      question: 'Do I still have exposure to the ETH price?',
      answer:
        'Yes. soETH tracks ETH. If ETH goes up or down, so does the dollar value of your position. ETH Yield adds yield on top of that exposure.',
    },
    {
      question: 'Can I use soETH with the card?',
      answer:
        'Not directly today. Card spending is powered by your USD balance. You can withdraw ETH and swap to USDC in-app whenever you want to spend it.',
    },
  ],
  [VaultType.FUSE]: [
    {
      question: 'What is soFUSE?',
      answer:
        'Your yield-bearing FUSE. Deposit FUSE and receive soFUSE. Your soFUSE grows in value as staking rewards compound, so you never need to claim anything.',
    },
    {
      question: 'Where does the yield come from?',
      answer:
        'Your FUSE is staked to secure the Fuse Network, the chain Solid runs on, earning native staking rewards. Solid adds a boost on top from the Fuse treasury, which is why FUSE Yield pays more than staking FUSE anywhere else.',
    },
    {
      question: 'Do I still have exposure to the FUSE price?',
      answer:
        'Yes. soFUSE tracks FUSE. FUSE Yield adds yield in FUSE terms; the dollar value still moves with the market.',
    },
    {
      question: 'Is this the same as Skip the Line staking?',
      answer:
        'Yes. Your FUSE Yield deposit is what counts for Skip the Line. Hold 50,000 FUSE in FUSE Yield to unlock Prime, or 400,000 to unlock Ultra. You earn yield and unlock your tier with the same deposit.',
    },
    {
      question: 'Why put FUSE in FUSE Yield rather than just holding it?',
      answer:
        'Idle FUSE earns nothing. The same FUSE in FUSE Yield earns network rewards plus the treasury boost, keeps earning Solid Rewards points, and counts toward Prime or Ultra through Skip the Line. One deposit, three benefits.',
    },
  ],
  // TODO(soEURC): product to review and move this copy to the Monday board above.
  [VaultType.EUR]: [
    {
      question: 'What is soEURC?',
      answer:
        'Your euro savings. Deposit EURC, the euro stablecoin, on Base and receive soEURC. Your balance is shown in euros, never converted to dollars.',
    },
    {
      question: 'How do I deposit?',
      answer:
        'Send EURC on Base to your EUR savings deposit address, or move EURC you already hold in your Solid wallet. Only EURC on Base is supported for EUR Yield.',
    },
    {
      question: 'Does EUR Yield earn interest yet?',
      answer: 'Not yet. Yield is coming soon. Until it starts earning, its APY shows as —.',
    },
    {
      question: 'Does EUR Yield count toward my yield boost?',
      answer:
        "Yes. On Prime and Ultra, your EUR Yield balance counts toward your tier's yield boost together with your other yields, at its value in dollars, up to your tier's limit. The boost is paid in soFUSE, and you claim it from Earn.",
    },
    {
      question: 'How fast can I withdraw?',
      answer:
        'Withdrawals go through a queue and take up to about 3 days. You receive EURC on Base in your Solid wallet.',
    },
  ],
};

/** FAQ list for a vault, falling back to the USDC vault for an unknown type. */
export const getVaultFaqs = (vaultType: VaultType): Faq[] =>
  VAULT_FAQS[vaultType] ?? VAULT_FAQS[VaultType.USDC];

export default VAULT_FAQS;
