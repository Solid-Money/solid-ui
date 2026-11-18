import React from 'react';
import { BackHandler, Platform } from 'react-native';

import SpendingModeCard from '@/components/Card/NewCardDetails/SpendingModeCard';
import SpendModeModals from '@/components/Card/NewCardDetails/SpendMode/SpendModeModals';
import { CardProvider, CardStatus, KycStatus } from '@/lib/types';
import { useCardPaneStore } from '@/store/useCardPaneStore';
import { useSpendModeHelpStore } from '@/store/useSpendModeHelpStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

let mockCardStatus = CardStatus.ACTIVE;
let mockCustomerStatus = KycStatus.APPROVED;
let mockProvider = CardProvider.WIREX;

jest.mock('@/hooks/useCardDetails', () => ({
  useCardDetails: () => ({ data: { status: mockCardStatus } }),
}));
jest.mock('@/hooks/useCardProvider', () => ({
  useCardProvider: () => ({ provider: mockProvider }),
}));
jest.mock('@/hooks/useCustomer', () => ({
  useCustomer: () => ({ data: { status: mockCustomerStatus } }),
}));
jest.mock('@/store/useUserStore', () => ({
  useUserStore: (selector: any) => selector({ users: [{ selected: true, userId: 'user-a' }] }),
}));
jest.mock('@/lib/mmvkStorage', () => ({
  __esModule: true,
  default: () => ({
    getItem: () => null,
    setItem: jest.fn(),
    removeItem: jest.fn(),
  }),
}));
jest.mock('@/components/Card/NewCardDetails/SpendMode/SpendModeSheet', () => ({
  __esModule: true,
  default: 'SpendModeSheet',
}));
jest.mock('@/components/Card/NewCardDetails/SpendMode/SpendModeHelpModal', () => ({
  __esModule: true,
  default: 'SpendModeHelpModal',
}));
jest.mock('@/components/Card/NewCardDetails/SpendMode/BorrowPositionSheet', () => ({
  __esModule: true,
  default: 'BorrowPositionSheet',
}));
jest.mock('@/components/Card/NewCardDetails/SpendMode/CollateralHelpSheet', () => ({
  __esModule: true,
  default: 'CollateralHelpSheet',
}));
jest.mock('@/components/Card/WirexCardFundModal', () => ({
  __esModule: true,
  default: 'WirexCardFundModal',
}));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/Card/NewCardDetails/icons', () => ({ InlineChevronIcon: 'Chevron' }));

let tree: any;
const sheet = () => tree.root.findByType('SpendModeSheet').props;
const help = () => tree.root.findByType('SpendModeHelpModal').props;
const collateralHelp = () => tree.root.findByType('CollateralHelpSheet').props;
const creditDetails = () => tree.root.findByType('BorrowPositionSheet').props;
const funds = () => tree.root.findByType('WirexCardFundModal').props;
const render = (canChangeMode = true) => {
  act(() => {
    tree = create(<SpendModeModals figures={{ mode: 'cash', canChangeMode }} />);
  });
};
const open = () => act(() => useCardPaneStore.getState().openSpendMode());

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mockCardStatus = CardStatus.ACTIVE;
  mockCustomerStatus = KycStatus.APPROVED;
  mockProvider = CardProvider.WIREX;
  useCardPaneStore.setState({ isOpen: false, isSpendModeOpen: false, originRect: null });
  useSpendModeHelpStore.setState({ shownByUserId: {} });
});

afterEach(() => {
  act(() => tree?.unmount());
  tree = undefined;
  useCardPaneStore.getState().close();
  jest.restoreAllMocks();
});

test('opens and dismisses over Home, with help only on the first opening', () => {
  render();
  open();
  expect(sheet().isOpen).toBe(true);
  expect(sheet().activeMode).toBe('cash');
  expect(help().isOpen).toBe(true);
  expect(useSpendModeHelpStore.getState().shownByUserId['user-a']).toBe(true);
  expect(useCardPaneStore.getState().isOpen).toBe(false);

  act(() => help().onClose());
  expect(sheet().isOpen).toBe(true);
  act(() => sheet().onOpenChange(false));
  expect(sheet().isOpen).toBe(false);
  expect(help().isOpen).toBe(false);
  expect(useCardPaneStore.getState().isOpen).toBe(false);

  open();
  expect(sheet().isOpen).toBe(true);
  expect(help().isOpen).toBe(false);
  act(() => sheet().onHelpPress());
  expect(help().isOpen).toBe(true);
});

test('the "?" beside Collateral assets opens How collateral works, not the intro', () => {
  useSpendModeHelpStore.getState().markShown('user-a');
  render();
  open();
  expect(collateralHelp().isOpen).toBe(false);

  act(() => sheet().onCollateralHelpPress());
  expect(collateralHelp().isOpen).toBe(true);
  expect(help().isOpen).toBe(false);
  expect(sheet().isOpen).toBe(true);

  act(() => collateralHelp().onOpenChange(false));
  expect(collateralHelp().isOpen).toBe(false);
  expect(sheet().isOpen).toBe(true);

  // Closing the selector takes the explainer with it, and it stays shut on the next opening.
  act(() => sheet().onCollateralHelpPress());
  act(() => sheet().onOpenChange(false));
  expect(collateralHelp().isOpen).toBe(false);
  open();
  expect(collateralHelp().isOpen).toBe(false);
});

test('View Credit details hands over from the selector to the borrow position', () => {
  useSpendModeHelpStore.getState().markShown('user-a');
  render();
  open();
  expect(creditDetails().isOpen).toBe(false);

  act(() => sheet().onCollateralHelpPress());
  act(() => sheet().onViewCreditDetails());
  expect(creditDetails().isOpen).toBe(true);
  expect(sheet().isOpen).toBe(false);
  expect(collateralHelp().isOpen).toBe(false);

  act(() => creditDetails().onOpenChange(false));
  expect(creditDetails().isOpen).toBe(false);
  expect(sheet().isOpen).toBe(false);
});

test('Android Back closes How collateral works before the selector under it', () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const addListener = jest
    .spyOn(BackHandler, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() });
  useSpendModeHelpStore.getState().markShown('user-a');
  render();
  open();
  act(() => sheet().onCollateralHelpPress());
  const back = addListener.mock.calls.at(-1)?.[1];
  act(() => expect(back?.()).toBe(true));
  expect(collateralHelp().isOpen).toBe(false);
  expect(sheet().isOpen).toBe(true);
});

test('leaves an already open card pane and its return position intact', () => {
  const originRect = { x: 16, y: 100, width: 360, height: 220 };
  useCardPaneStore.getState().open(originRect);
  render();
  open();
  act(() => sheet().onOpenChange(false));
  expect(useCardPaneStore.getState()).toMatchObject({
    isOpen: true,
    originRect,
    isSpendModeOpen: false,
  });
});

test.each(['Spend mode', 'Cash', 'Change'])(
  'opens the selector from the card row when tapping %s',
  label => {
    useCardPaneStore.getState().open();
    useSpendModeHelpStore.getState().markShown('user-a');
    act(() => {
      tree = create(
        <>
          <SpendingModeCard mode="cash" onChangeMode={useCardPaneStore.getState().openSpendMode} />
          <SpendModeModals figures={{ mode: 'cash', canChangeMode: true }} />
        </>,
      );
    });
    const text = tree.root
      .findAllByType('Text')
      .find((node: any) => node.children.join('') === label);
    let target = text;
    while (target && typeof target.props.onPress !== 'function') target = target.parent;
    expect(target).toBeDefined();
    expect(target.props.accessibilityRole).toBe('button');
    act(() => target.props.onPress());
    expect(sheet().isOpen).toBe(true);
    expect(useCardPaneStore.getState().isOpen).toBe(true);
    act(() => sheet().onOpenChange(false));
    expect(useCardPaneStore.getState().isOpen).toBe(true);
  },
);

test('closes the selector before funding and returns to Home afterwards', () => {
  render();
  open();
  act(() => sheet().onAddFunds());
  expect(sheet().isOpen).toBe(false);
  expect(help().isOpen).toBe(false);
  expect(funds().isOpen).toBe(true);
  expect(useCardPaneStore.getState().isOpen).toBe(false);
  act(() => funds().onOpenChange(false));
  expect(funds().isOpen).toBe(false);
  expect(sheet().isOpen).toBe(false);
});

test.each(['frozen card', 'restricted customer', 'Rain card'])(
  'keeps Add funds unavailable for a %s',
  restriction => {
    if (restriction === 'frozen card') mockCardStatus = CardStatus.FROZEN;
    if (restriction === 'restricted customer') mockCustomerStatus = KycStatus.PAUSED;
    if (restriction === 'Rain card') mockProvider = CardProvider.RAIN;
    render();
    open();
    expect(sheet().onAddFunds).toBeUndefined();
  },
);

test('discards an unavailable selector without opening the card pane or marking help seen', () => {
  render(false);
  open();
  expect(sheet().isOpen).toBe(false);
  expect(help().isOpen).toBe(false);
  expect(useCardPaneStore.getState()).toMatchObject({ isOpen: false, isSpendModeOpen: false });
  expect(useSpendModeHelpStore.getState().shownByUserId['user-a']).toBeUndefined();
});

test('Android Back dismisses the selector while retaining the card pane underneath', () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const remove = jest.fn();
  const addListener = jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove });
  useCardPaneStore.getState().open();
  useSpendModeHelpStore.getState().markShown('user-a');
  render();
  open();
  const back = addListener.mock.calls.at(-1)?.[1];
  act(() => expect(back?.()).toBe(true));
  expect(sheet().isOpen).toBe(false);
  expect(useCardPaneStore.getState().isOpen).toBe(true);
  expect(remove).toHaveBeenCalled();
});
