import UsdFlag from '@/assets/images/usd-fiat-currency';
import UsdcIcon from '@/assets/images/usdc-cryptocurrency';
import type { ComponentType } from 'react';
import { SvgProps } from 'react-native-svg';
import { BridgeTransferCryptoCurrency, BridgeTransferFiatCurrency } from './enums';

export type SvgIcon = ComponentType<SvgProps>;

// Temporary mapping: use USD icon for EUR as well. MXN intentionally left undefined for now.
export const FIAT_ICON_MAP: Partial<Record<BridgeTransferFiatCurrency, SvgIcon>> = {
  [BridgeTransferFiatCurrency.USD]: UsdFlag,
  [BridgeTransferFiatCurrency.EUR]: UsdFlag,
  [BridgeTransferFiatCurrency.MXN]: UsdFlag,
};

export const getFiatIcon = (code: BridgeTransferFiatCurrency) => FIAT_ICON_MAP[code];

export const CRYPTO_ICON_MAP: Partial<Record<BridgeTransferCryptoCurrency, SvgIcon>> = {
  [BridgeTransferCryptoCurrency.USDC]: UsdcIcon,
  [BridgeTransferCryptoCurrency.USDT]: UsdcIcon, // temporary
};

export const getCryptoIcon = (code: BridgeTransferCryptoCurrency) => CRYPTO_ICON_MAP[code];
