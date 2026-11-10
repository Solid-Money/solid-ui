import React from 'react';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { useHomeLinkAction } from '@/hooks/useHomeLinkAction';
import { useWhatsNewStore } from '@/store/useWhatsNewStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

let mockParams: Record<string, string | undefined> = {};
const mockSetParams = jest.fn();
const mockOpenDepositFlow = jest.fn();
const mockOpenSpendMode = jest.fn();
const mockOpenCardPane = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  router: { setParams: (params: Record<string, undefined>) => mockSetParams(params) },
}));
jest.mock('@/hooks/useOpenDepositFlow', () => ({
  useOpenDepositFlow: () => mockOpenDepositFlow,
}));
jest.mock('@/store/useCardPaneStore', () => ({
  useCardPaneStore: (select: (state: object) => unknown) =>
    select({ openSpendMode: mockOpenSpendMode, open: mockOpenCardPane }),
}));

const ID = '6ac4df9322b1a60a4458ab80';

type Context = Parameters<typeof useHomeLinkAction>[0];
const known: Context = {
  isCardKnown: true,
  hasCard: true,
  isSpendModeKnown: true,
  canChangeMode: true,
};

const Probe = (props: Context) => {
  useHomeLinkAction(props);
  return null;
};

const render = async (context: Context) => {
  let renderer: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(<Probe {...context} />);
  });
  return renderer!;
};

const CLEARED = {
  whatsNew: undefined,
  whatsNewStep: undefined,
  spendMode: undefined,
  deposit: undefined,
};

describe('useHomeLinkAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    useWhatsNewStore.setState({ request: null });
  });

  it('does nothing on plain Home', async () => {
    await render(known);
    expect(mockOpenDepositFlow).not.toHaveBeenCalled();
    expect(mockSetParams).not.toHaveBeenCalled();
  });

  it('asks for the linked What’s New page, then clears the params', async () => {
    mockParams = { whatsNew: ID, whatsNewStep: '2' };
    await render(known);

    expect(useWhatsNewStore.getState().request).toEqual({ id: ID, step: 2 });
    expect(mockSetParams).toHaveBeenCalledWith(CLEARED);
  });

  it.each([
    ['cash', DEPOSIT_MODAL.OPEN_DEPOSIT_CASH],
    ['open', DEPOSIT_MODAL.OPEN_DEPOSIT_TYPE],
  ])('opens the deposit sheet on %s once', async (deposit, modal) => {
    mockParams = { deposit };
    const renderer = await render(known);
    // A dependency settling re-runs the effect before the params are gone.
    await act(async () => renderer.update(<Probe {...known} canChangeMode={false} />));

    expect(mockOpenDepositFlow).toHaveBeenCalledTimes(1);
    expect(mockOpenDepositFlow).toHaveBeenCalledWith({ modal, source: 'deep_link' });
    expect(mockSetParams).toHaveBeenCalledWith(CLEARED);
  });

  it('waits for card status before acting on the spend-mode link', async () => {
    mockParams = { spendMode: 'open' };
    const renderer = await render({ ...known, isCardKnown: false, isSpendModeKnown: false });
    expect(mockOpenSpendMode).not.toHaveBeenCalled();
    expect(mockSetParams).not.toHaveBeenCalled();

    await act(async () => renderer.update(<Probe {...known} />));
    expect(mockOpenSpendMode).toHaveBeenCalledTimes(1);
    expect(mockSetParams).toHaveBeenCalledWith(CLEARED);
  });

  it('opens the card pane for a cardholder who cannot switch modes', async () => {
    mockParams = { spendMode: 'open' };
    await render({ ...known, canChangeMode: false });

    expect(mockOpenSpendMode).not.toHaveBeenCalled();
    expect(mockOpenCardPane).toHaveBeenCalledTimes(1);
  });

  it('stays on Home for someone without a card, and still clears the link', async () => {
    mockParams = { spendMode: 'open' };
    await render({ ...known, hasCard: false, isSpendModeKnown: false });

    expect(mockOpenSpendMode).not.toHaveBeenCalled();
    expect(mockOpenCardPane).not.toHaveBeenCalled();
    expect(mockSetParams).toHaveBeenCalledWith(CLEARED);
  });
});
