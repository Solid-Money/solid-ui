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

/** Map persisted or legacy `outputToken` values to a real BRIDGE_TOKENS key for `chainId` and `vault`. */
export function resolveDepositBridgeTokenKey(
  chainId: number,
  outputToken: string | undefined,
  vault?: Vault,
): string {
  const allowed = getAllowedTokensForChain(chainId, vault);
  const raw = outputToken?.trim() ?? '';
  if (!allowed.length) {
    return getDefaultDepositSelection(vault).outputToken;
  }
  if (!raw) {
    return allowed[0];
  }
  if (allowed.includes(raw)) return raw;
  const caseMatch = allowed.find(t => t.toUpperCase() === raw.toUpperCase());
  if (caseMatch) return caseMatch;
  // Legacy: vault receipt token (e.g. soUSD) was wrongly stored as the bridge "output" key
  if (vault?.vaultToken && raw.toUpperCase() === vault.vaultToken.toUpperCase()) {
    return allowed[0];
  }
  const bridgeKeys = Object.keys(BRIDGE_TOKENS[chainId]?.tokens ?? {});
  const onBridge =
    bridgeKeys.includes(raw) || bridgeKeys.some(k => k.toUpperCase() === raw.toUpperCase());
  if (onBridge && !allowed.includes(raw)) {
    return allowed[0];
  }
  return getDefaultDepositSelection(vault).outputToken;
}
