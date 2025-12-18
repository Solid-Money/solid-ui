import EurFlag from '@/assets/images/eur-fiat-currency';
import UsdFlag from '@/assets/images/usd-fiat-currency';
import UsdcIcon from '@/assets/images/usdc-cryptocurrency';
import type { ComponentType } from 'react';
import { SvgProps } from 'react-native-svg';
import { BridgeTransferCryptoCurrency, BridgeTransferFiatCurrency } from './enums';

export type SvgIcon = ComponentType<SvgProps>;

export const FIAT_ICON_MAP: Partial<Record<BridgeTransferFiatCurrency, SvgIcon>> = {
  [BridgeTransferFiatCurrency.USD]: UsdFlag,
  [BridgeTransferFiatCurrency.EUR]: EurFlag,
  [BridgeTransferFiatCurrency.MXN]: UsdFlag,
  [BridgeTransferFiatCurrency.BRL]: UsdFlag,
};

export const getFiatIcon = (code: BridgeTransferFiatCurrency) => FIAT_ICON_MAP[code];

export const CRYPTO_ICON_MAP: Partial<Record<BridgeTransferCryptoCurrency, SvgIcon>> = {
  [BridgeTransferCryptoCurrency.USDC]: UsdcIcon,
  [BridgeTransferCryptoCurrency.USDT]: UsdcIcon, // temporary
};

export const getCryptoIcon = (code: BridgeTransferCryptoCurrency) => CRYPTO_ICON_MAP[code];
