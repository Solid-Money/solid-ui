import { Faq, VaultType } from '@/lib/types';

/**
 * Per-vault FAQ copy for the vault detail screen.
 *
 * The savings screen used to show one soUSD-centric list on all three vaults,
 * so someone opening the ETH or FUSE vault was told what soUSD is and why they
 * didn't receive 1 soUSD per USDC. Each vault answers for itself here instead.
 *
 * Copy is product-owned (Monday 12943830277) and reproduced verbatim — edit it
 * there, not here. The exceptions are the EUR vault's copy, written with the
 * vault's launch, and the soETH card answer, rewritten when soETH became
 * spendable on Base: neither is on that board yet.
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
        'Yes, on Base. Once Base spending is on, your card can spend soETH held on Base, and in Credit mode you can borrow against it without selling. soETH you deposit on Base is ready to use there. soETH you hold on Fuse or Ethereum is not spendable by the card.',
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
  // TODO(soBTC): product to review and move this copy to the Monday board above.
  [VaultType.BTC]: [
    {
      question: 'What is soBTC?',
      answer:
        'Your yield-bearing bitcoin. Deposit WBTC on Ethereum or cbBTC on Base and receive soBTC on Base. It grows in BTC terms as yield accrues, so you keep your bitcoin exposure.',
    },
    {
      question: 'Are WBTC and cbBTC treated the same?',
      answer:
        'Yes. soBTC counts 1 WBTC and 1 cbBTC as 1 BTC, so both earn the same rate and mint the same amount of soBTC. Your deposit stays on the network you sent it from and is never bridged.',
    },
    {
      question: 'Who backs WBTC and cbBTC?',
      answer:
        'Both are bitcoin held by a custodian: WBTC by BitGo, cbBTC by Coinbase. Each is worth 1 BTC as long as its custodian holds the bitcoin behind it, so soBTC carries that custodian risk too.',
    },
    {
      question: 'How do I withdraw?',
      answer:
        'Choose what you receive: cbBTC on Base, in one step, or WBTC on Ethereum, in two steps (your soBTC moves to Ethereum first, for a small fee in ETH on Base). Withdrawals go through a queue and usually finish within about 3 days.',
    },
    {
      question: 'Why does the amount I can withdraw differ between WBTC and cbBTC?',
      answer:
        'Each withdrawal is paid from the BTC held on that network: WBTC on Ethereum, cbBTC on Base. If more people deposited one than the other, one side holds less, and you can withdraw up to what it holds right now. The rest is still yours: withdraw it from the other side, or later.',
    },
  ],
};

/** FAQ list for a vault, falling back to the USDC vault for an unknown type. */
export const getVaultFaqs = (vaultType: VaultType): Faq[] =>
  VAULT_FAQS[vaultType] ?? VAULT_FAQS[VaultType.USDC];

export default VAULT_FAQS;
