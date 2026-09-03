import React, { ReactNode } from 'react';
import { Image } from 'expo-image';

import { AssetPath, getAsset } from '@/lib/assets';

/** Matches the token rows' icon so both sections line up. */
const FLAG_SIZE = 36;
const FLAG_STYLE = { width: FLAG_SIZE, height: FLAG_SIZE, borderRadius: FLAG_SIZE / 2 };

const flagImage = (asset: AssetPath): ReactNode => (
  <Image source={getAsset(asset)} style={FLAG_STYLE} contentFit="cover" />
);

export type CardFundLocalCurrency = {
  /** ISO code, e.g. 'BRL'. */
  code: string;
  icon: ReactNode;
};

/**
 * Local currencies offered under "Cash deposit", in display order. Each opens the
 * TransFi buy-crypto flow preseeded with it; the bought USDC is delivered to the
 * card funding address, so it lands as card balance.
 *
 * The set mirrors the corridors TransFi's payment-config returns. It is listed
 * here rather than read from that response because the row needs its flag before
 * the config resolves — an earlier pass took the flags from that list at runtime
 * and they came back empty. So a new corridor is a row here plus its flag asset;
 * `TransfiCurrencySelector` remains the live view of what the backend supports.
 *
 * Flags are committed assets so a row always renders one. BDT, BRL and PHP are
 * exports of the design's circular flag nodes; the rest are rasterised from
 * flag-icons' square (1:1) set at the same 144x144, which keeps wide flags whole
 * instead of centre-cropping them. `flagImage` rounds them at render time, so the
 * source PNGs are square and need no circular mask of their own.
 *
 * Rails are not listed per currency: the row is flag + code, and the rail is
 * picked inside the flow.
 *
 * The leading three are the design's, not alphabetical: the "Cash deposit" group
 * shows only `CARD_FUND_CASH_DEPOSIT_VISIBLE_ROWS` rows before its "Show more"
 * footer, so the corridors the design puts on the first screen lead and the rest
 * follow alphabetically behind it.
 */
export const CARD_FUND_LOCAL_CURRENCIES: CardFundLocalCurrency[] = [
  { code: 'BRL', icon: flagImage('images/flag-brl.png') },
  { code: 'BDT', icon: flagImage('images/flag-bdt.png') },
  { code: 'PHP', icon: flagImage('images/flag-php.png') },
  { code: 'AED', icon: flagImage('images/flag-aed.png') },
  { code: 'ARS', icon: flagImage('images/flag-ars.png') },
  { code: 'COP', icon: flagImage('images/flag-cop.png') },
  { code: 'EUR', icon: flagImage('images/flag-eur.png') },
  { code: 'GHS', icon: flagImage('images/flag-ghs.png') },
  { code: 'IDR', icon: flagImage('images/flag-idr.png') },
  { code: 'KES', icon: flagImage('images/flag-kes.png') },
  { code: 'MXN', icon: flagImage('images/flag-mxn.png') },
  { code: 'MYR', icon: flagImage('images/flag-myr.png') },
  { code: 'NGN', icon: flagImage('images/flag-ngn.png') },
  { code: 'PEN', icon: flagImage('images/flag-pen.png') },
  { code: 'UGX', icon: flagImage('images/flag-ugx.png') },
  { code: 'ZMW', icon: flagImage('images/flag-zmw.png') },
];
