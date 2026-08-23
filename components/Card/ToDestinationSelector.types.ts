import { CardCollateralTokenBalanceDto } from '@/lib/types';
import { CardDepositSource } from '@/store/useCardDepositStore';

export type ToDestinationProps = {
  onChange: (value: CardDepositSource) => void;
  tokenSymbol?: string;
  /**
   * Collateral assets the card actually holds, richest first. A card funded in
   * USDT and one funded in USDC both back the same spending balance, but each
   * is withdrawn separately — so every asset has to be offered, not just the
   * one the app happens to default to.
   */
  assets?: CardCollateralTokenBalanceDto[];
  /** Address of the asset currently selected. */
  selectedTokenAddress?: string;
  onSelectAsset?: (asset: CardCollateralTokenBalanceDto) => void;
};
