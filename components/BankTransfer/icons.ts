import { SvgProps } from 'react-native-svg';

import BrlFlag from '@/assets/images/brl-fiat-currency';
import EurFlag from '@/assets/images/eur-fiat-currency';
import GbpFlag from '@/assets/images/gbp-fiat-currency';
import MxnFlag from '@/assets/images/mxn-fiat-currency';
import UsdFlag from '@/assets/images/usd-fiat-currency';
import UsdcIcon from '@/assets/images/usdc-cryptocurrency';

import { BridgeTransferCryptoCurrency, BridgeTransferFiatCurrency } from './enums';

import type { ComponentType } from 'react';

export type SvgIcon = ComponentType<SvgProps>;

export const FIAT_ICON_MAP: Partial<Record<BridgeTransferFiatCurrency, SvgIcon>> = {
  [BridgeTransferFiatCurrency.USD]: UsdFlag,
  [BridgeTransferFiatCurrency.EUR]: EurFlag,
  [BridgeTransferFiatCurrency.GBP]: GbpFlag,
  [BridgeTransferFiatCurrency.MXN]: MxnFlag,
  [BridgeTransferFiatCurrency.BRL]: BrlFlag,
};

export const getFiatIcon = (code: BridgeTransferFiatCurrency) => FIAT_ICON_MAP[code];

export const CRYPTO_ICON_MAP: Partial<Record<BridgeTransferCryptoCurrency, SvgIcon>> = {
  [BridgeTransferCryptoCurrency.USDC]: UsdcIcon,
  [BridgeTransferCryptoCurrency.USDT]: UsdcIcon, // temporary
};

export const getCryptoIcon = (code: BridgeTransferCryptoCurrency) => CRYPTO_ICON_MAP[code];
