import { BRIDGE_TOKENS } from '@/constants/bridge';
import { VAULTS } from '@/constants/vaults';
import { DepositMethod, TokenBalance, Vault, VaultDepositConfig } from '@/lib/types';

const DEFAULT_METHODS: DepositMethod[] = [
  'wallet',
  'deposit_directly',
  'credit_card',
  'bank_transfer',
  'buy_crypto',
];

const ALL_SUPPORTED_CHAINS = Object.keys(BRIDGE_TOKENS).map(Number);
const ALL_SUPPORTED_TOKENS = Array.from(
  new Set(Object.values(BRIDGE_TOKENS).flatMap(chain => Object.keys(chain.tokens ?? {}))),
);

const LIVE_VAULTS = VAULTS.filter(vault => !vault.isComingSoon);

export type TokenVault = {
  vault: Vault;
  /** Index into VAULTS — what useSavingStore.selectVaultForDeposit expects. */
  index: number;
};

/** True when the address is a vault share token (soUSD / soFUSE / soETH), i.e. a savings position. */
export const isVaultShareToken = (contractAddress?: string): boolean => {
  const address = contractAddress?.toLowerCase();
  if (!address) return false;

  return LIVE_VAULTS.some(vault => vault.vaults.some(v => v.address.toLowerCase() === address));
};

/**
 * The vault a wallet token belongs to — matched either as the vault share token
 * (by address) or as the vault's underlying asset (by symbol). Tokens without a
 * vault are not yield bearing, so their coin page hides APY and savings balance.
 */
export const getTokenVault = (token?: {
  contractAddress?: string;
  contractTickerSymbol?: string;
}): TokenVault | undefined => {
  const address = token?.contractAddress?.toLowerCase();
  const symbol = token?.contractTickerSymbol?.toUpperCase();
  if (!address && !symbol) return undefined;

  const vault = LIVE_VAULTS.find(
    v =>
      (!!address && v.vaults.some(entry => entry.address.toLowerCase() === address)) ||
      (!!symbol && (symbol === v.vaultToken.toUpperCase() || symbol === v.name.toUpperCase())),
  );

  return vault ? { vault, index: VAULTS.indexOf(vault) } : undefined;
};

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

/** The wallet-token fields `hasDepositableWalletBalance` reads. */
type DepositableToken = Pick<TokenBalance, 'chainId' | 'contractTickerSymbol' | 'balance'>;

/**
 * Whether any of these wallet tokens could be deposited into `vault` — one the
 * vault accepts, held on a chain it accepts, with a non-zero balance.
 *
 * Not the same question as "does the wallet hold anything": the deposit-from-Solid
 * form is per-vault and per-chain (soUSD takes USDC/USDT on any bridged chain,
 * soETH takes ETH/WETH on Ethereum, soFUSE takes FUSE/WFUSE on Fuse), so someone
 * holding only FUSE has funds but none the USD vault could take.
 */
export const hasDepositableWalletBalance = (tokens: DepositableToken[], vault?: Vault): boolean => {
  const { supportedChains, supportedTokens } = getVaultDepositConfig(vault);
  const accepted = new Set(supportedTokens.map(symbol => symbol.toUpperCase()));

  return tokens.some(
    token =>
      supportedChains.includes(token.chainId) &&
      accepted.has(token.contractTickerSymbol?.toUpperCase()) &&
      BigInt(token.balance || '0') > 0n,
  );
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
  const principalToken = allowedTokens[0] ?? 'USDC';

  return { chainId, principalToken };
};
