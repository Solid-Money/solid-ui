import React from 'react';

import CardFundOptions from '@/components/Card/CardFund/CardFundOptions';
import { RAIN_CARD_FUND_SECTIONS, WIREX_CARD_FUND_SECTIONS } from '@/lib/utils/cardFunding';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * "Fund your card", step 1.
 *
 * Cash App is a USD method, so it is listed under USD, beside Apple Pay, rather
 * than as a row of its own at the bottom of the list — and an issuer with no
 * USD section (Wirex) does not offer it at all.
 */

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('lucide-react-native', () => ({
  Building2: 'Building2',
  CreditCard: 'CreditCard',
  Zap: 'Zap',
}));
jest.mock('@/assets/images/apple-pay-circle', () => 'ApplePayCircle');
jest.mock('@/assets/images/fund-external-wallet', () => 'FundExternalWallet');
jest.mock('@/assets/images/fund-move-savings', () => 'FundMoveSavings');
jest.mock('@/components/Card/CardFund/CardFundGroup', () => 'CardFundGroup');
jest.mock('@/components/Card/CardFund/CardFundRow', () => 'CardFundRow');
jest.mock('@/components/NeedHelp', () => 'NeedHelp');
// The real module pulls `lib/assets`, which does not load under jest-expo; the
// sections and copy come from the leaf module it re-exports them from.
jest.mock('@/components/Card/CardFund/constants', () => ({
  ...jest.requireActual('@/lib/utils/cardFunding'),
  CARD_FUND_CASH_DEPOSIT_VISIBLE_ROWS: 4,
  CARD_FUND_TOKENS: [
    { symbol: 'USDC', icon: 'usdc' },
    { symbol: 'USDT', icon: 'usdt' },
  ],
  CARD_FUND_USD_ICON: 'usd',
  getCardFundNetworkChips: () => [],
}));
jest.mock('@/components/Card/CardFund/localCurrencies', () => ({
  CARD_FUND_LOCAL_CURRENCIES: [
    { code: 'EUR', icon: null },
    { code: 'BRL', icon: null },
  ],
  getCardFundLocalPaymentMethods: () => [],
}));
// DepositUsdOptions is loaded for the USD chips it shares with the wallet's cash
// list. Its own screen's hooks and stores are never called here, only stubbed so
// the module loads.
jest.mock(
  '@/components/DepositOption/VirtualAccountDetails/VirtualAccountApplyDialog',
  () => 'VirtualAccountApplyDialog',
);
jest.mock('@/hooks/useCardProvider', () => ({}));
jest.mock('@/hooks/useOrchestra', () => ({}));
jest.mock('@/hooks/useVirtualAccountEntry', () => ({}));
jest.mock('@/lib/analytics', () => ({}));
jest.mock('@/store/useDepositStore', () => ({}));
jest.mock('@/store/useOrchestraStore', () => ({}));

type Props = React.ComponentProps<typeof CardFundOptions>;

const render = (props: Partial<Props>) => {
  let root: any;
  act(() => {
    root = create(<CardFundOptions onTokenPress={jest.fn()} {...props} />);
  });
  return root;
};

const rowsOf = (root: any) => root.root.findAllByType('CardFundRow');
const titlesOf = (root: any) => rowsOf(root).map((row: any) => row.props.title);
const rowTitled = (root: any, title: string) =>
  rowsOf(root).find((row: any) => row.props.title === title);

/** What the Rain modals pass, less Cash App. */
const RAIN_PROPS: Partial<Props> = {
  sections: RAIN_CARD_FUND_SECTIONS,
  onUsdPress: jest.fn(),
  onLocalCurrencyPress: jest.fn(),
  onMoveFromSavingsPress: jest.fn(),
  onExternalWalletPress: jest.fn(),
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});

it('names Cash App on the USD row instead of giving it a row at the bottom', () => {
  const root = render({ ...RAIN_PROPS, isCashAppAvailable: true });
  expect(titlesOf(root)).not.toContain('Cash App');
  expect(rowTitled(root, 'USD').props.chips).toEqual(['ACH', 'Wire', 'Cash App', 'Apple Pay']);
  act(() => root.unmount());
});

it('leaves Cash App off the USD row where it is not offered', () => {
  const root = render(RAIN_PROPS);
  expect(titlesOf(root)).not.toContain('Cash App');
  expect(rowTitled(root, 'USD').props.chips).toEqual(['ACH', 'Wire', 'Apple Pay']);
  act(() => root.unmount());
});

it('offers Wirex no Cash App, even where it is available, having no USD section', () => {
  const root = render({
    sections: WIREX_CARD_FUND_SECTIONS,
    isCashAppAvailable: true,
    onLocalCurrencyPress: jest.fn(),
    onMoveFromSavingsPress: jest.fn(),
  });
  const titles = titlesOf(root);
  expect(titles).not.toContain('USD');
  expect(titles).not.toContain('Cash App');
  act(() => root.unmount());
});
