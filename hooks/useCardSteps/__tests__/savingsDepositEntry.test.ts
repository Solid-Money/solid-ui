import { DEPOSIT_MODAL } from '@/constants/modals';
import {
  CARD_DEPOSIT_SOURCE,
  openCardSavingsDeposit,
} from '@/hooks/useCardSteps/savingsDepositEntry';

const setup = () => {
  const state = {
    setDepositFromSolid: jest.fn(),
    setSavingsFundIntent: jest.fn(),
    clearDirectDepositSession: jest.fn(),
  };
  const openDepositFlow = jest.fn();

  openCardSavingsDeposit(state, openDepositFlow);

  return { state, openDepositFlow };
};

describe('openCardSavingsDeposit', () => {
  it('opens the savings direct-deposit flow, not the legacy deposit options', () => {
    const { openDepositFlow } = setup();

    expect(openDepositFlow).toHaveBeenCalledTimes(1);
    expect(openDepositFlow).toHaveBeenCalledWith({
      modal: DEPOSIT_MODAL.OPEN_SAVINGS_FUND,
      source: CARD_DEPOSIT_SOURCE,
      buttonText: 'Deposit',
    });
  });

  // The regression this replaced: OPEN_OPTIONS led to the static Safe address
  // ("Share your deposit address" → "Your Solid address"), which cannot tell the
  // user their deposit was seen.
  it('never routes to the static-address options screen', () => {
    const { openDepositFlow } = setup();
    const { modal } = openDepositFlow.mock.calls[0][0];

    expect(modal.name).not.toBe(DEPOSIT_MODAL.OPEN_OPTIONS.name);
    expect(modal.name).not.toBe(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS.name);
  });

  it('marks the flow as the card deposit so only soUSD-minting tokens are offered', () => {
    const { state } = setup();

    expect(state.setSavingsFundIntent).toHaveBeenCalledWith('card_deposit');
  });

  it('sends new funds in rather than moving an existing Solid balance', () => {
    const { state } = setup();

    expect(state.setDepositFromSolid).toHaveBeenCalledWith(false);
  });

  // directDepositSession is persisted, so without this the step can reopen on a
  // stale address for a chain the user is no longer depositing on.
  it('clears any persisted direct-deposit session before opening', () => {
    const { state } = setup();

    expect(state.clearDirectDepositSession).toHaveBeenCalledTimes(1);
  });
});
