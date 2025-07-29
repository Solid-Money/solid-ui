
import { Faq } from "@/lib/types";

const faqs: Faq[] = [
  {
    question: 'What is SOLID?',
    answer: 'SOLID is a full-stack DeFi protocol that lets users **earn, spend, and save** directly from their self-custodial wallet. At its core is **SoUSD** — a yield-bearing, non-custodial stablecoin designed for a seamless, cross-chain experience.',
  },
  {
    question: 'How does SOLID work?',
    answer: 'When you deposit USDC, you mint SoUSD — a token that represents **shares** in a vault optimized for yield. Your funds are allocated into **whitelisted, audited DeFi strategies**. You earn automatically as the vault grows in value.\nNo staking. No lockups. Yield compounds passively.\n\n*Note:* While we abstract gas and signatures for simplicity, you still sign transactions and pay gas when minting or redeeming.',
  },
  {
    question: 'What makes SOLID different?',
    answer: 'SOLID offers **DeFi without the headaches**.\nYou get:\n* Real yield from curated strategies\n* Abstracted bridging & gas management\n* Full control through self-custody\n* A sleek interface and upcoming payment card\n\nAll in one protocol, designed to just work — for everyone.',
  },
  {
    question: 'What is SoUSD?',
    answer: 'SoUSD is a **yield-bearing stablecoin**. Unlike typical 1:1 pegged stablecoins, SoUSD represents your share in a growing vault. Its value **increases over time** as interest accrues — no need to stake or manage positions.\n\nSoUSD is gasless, cross-chain, and composable — ready for use in payments, swaps, lending, and more.',
  },
  {
    question: "Why didn't I receive 1 SoUSD per 1 USDC?",
    answer: "SoUSD uses a **dynamic exchange rate**, based on the vault's current performance:\n```\nexchange rate = total assets / total shares\n```\nIf the vault has earned yield, each SoUSD is worth **more than $1**, so you'll receive **fewer SoUSD tokens** — but your **USD-equivalent value is preserved** and grows over time.",
  },
  {
    question: 'Where does the yield come from?',
    answer: 'Yield comes from **BoringVaults** — a set of curated DeFi strategies across chains. Capital is deployed into **secure, audited protocols** with strong performance histories (e.g., lending markets, staking). Strategies are selected based on **risk, uptime**, and **on-chain performance**, ensuring your SoUSD earns reliable, **risk-adjusted yield** — without you lifting a finger.',
  },
];

export default faqs;
