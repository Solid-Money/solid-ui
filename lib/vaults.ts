import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DepositMethod, Vault, VaultDepositConfig } from '@/lib/types';

const DEFAULT_METHODS: DepositMethod[] = [
  'wallet',
  'deposit_directly',
  'credit_card',
  'bank_transfer',
];

const ALL_SUPPORTED_CHAINS = Object.keys(BRIDGE_TOKENS).map(Number);
const ALL_SUPPORTED_TOKENS = Array.from(
  new Set(Object.values(BRIDGE_TOKENS).flatMap(chain => Object.keys(chain.tokens ?? {}))),
);

export const getVaultDepositConfig = (vault?: Vault): VaultDepositConfig => {
  const config = vault?.depositConfig;

  return {
    methods: config?.methods?.length ? config.methods : DEFAULT_METHODS,
    supportedChains: config?.supportedChains?.length
      ? config.supportedChains
      : ALL_SUPPORTED_CHAINS,
    supportedTokens: config?.supportedTokens?.length
      ? config.supportedTokens
      : ALL_SUPPORTED_TOKENS,
  };
};

export const getAllowedTokensForChain = (chainId: number, vault?: Vault): string[] => {
  const config = getVaultDepositConfig(vault);
  const tokens = Object.keys(BRIDGE_TOKENS[chainId]?.tokens ?? {});

  return tokens.filter(symbol => config.supportedTokens.includes(symbol));
};

export const getDefaultDepositSelection = (vault?: Vault) => {
  const config = getVaultDepositConfig(vault);
  const supportedChains = config.supportedChains.length
    ? config.supportedChains
    : ALL_SUPPORTED_CHAINS;
  const chainId =
    supportedChains.find(id => getAllowedTokensForChain(id, vault).length > 0) ??
    supportedChains[0];
  const allowedTokens = chainId ? getAllowedTokensForChain(chainId, vault) : [];
  const outputToken = allowedTokens[0] ?? 'USDC';

  return { chainId, outputToken };
};
