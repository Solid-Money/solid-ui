import React, { ReactNode } from 'react';
import { Image } from 'expo-image';

import MxnFlag from '@/assets/images/mxn-fiat-currency';
import { getAsset } from '@/lib/assets';

/** Matches the token rows' icon so both sections line up. */
const FLAG_SIZE = 36;
const FLAG_STYLE = { width: FLAG_SIZE, height: FLAG_SIZE, borderRadius: FLAG_SIZE / 2 };

const flagImage = (asset: string): ReactNode => (
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
 * Flags are committed assets, exported from the design's circular flag nodes, so
 * a row always renders one — an earlier pass took them from TransFi's currency
 * list at runtime and they came back empty. MXN has no row in that design frame,
 * so it reuses the flag the bank-transfer flow already ships; swap it for an
 * export once the frame has one.
 *
 * Rails are not listed per currency: the row is flag + code, and the rail is
 * picked inside the flow.
 */
export const CARD_FUND_LOCAL_CURRENCIES: CardFundLocalCurrency[] = [
  { code: 'BDT', icon: flagImage('images/flag-bdt.png') },
  { code: 'BRL', icon: flagImage('images/flag-brl.png') },
  // The shared flag is drawn at 21x22 with no viewBox of its own, so one is
  // supplied here to scale it up to the row size instead of cropping it.
  { code: 'MXN', icon: <MxnFlag width={FLAG_SIZE} height={FLAG_SIZE} viewBox="0 0 21 22" /> },
  { code: 'PHP', icon: flagImage('images/flag-php.png') },
];
