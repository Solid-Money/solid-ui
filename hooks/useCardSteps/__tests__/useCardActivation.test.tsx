import React from 'react';

import { useCardActivation } from '@/hooks/useCardSteps/stepHelpers';
import { CardStatus } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

type Activation = ReturnType<typeof useCardActivation>;

/** Mount the hook; `latest()` reads its most recent value. */
const mount = async () => {
  // Collected rather than assigned: the react-compiler rule treats reassigning
  // an outer binding from a component as a render side-effect.
  const seen: Activation[] = [];
  const router = { navigate: jest.fn(), push: jest.fn() };
  const Probe = () => {
    seen.push(useCardActivation(router as never));
    return null;
  };
  await act(async () => {
    create(<Probe />);
  });
  return () => seen[seen.length - 1];
};

/**
 * The activate screen polls card status. A closed card that becomes
 * replaceable after an earlier read marked it activated must reopen the step,
 * or the "Get new card" button stays hidden behind a completed step.
 */
describe('useCardActivation.syncCardActivationState', () => {
  it('marks a closed card support has to replace as activated', async () => {
    const latest = await mount();

    await act(async () => latest().syncCardActivationState(CardStatus.INACTIVE, false));

    expect(latest().cardActivated).toBe(true);
  });

  it('reopens the step when the closed card becomes replaceable', async () => {
    const latest = await mount();

    await act(async () => latest().syncCardActivationState(CardStatus.INACTIVE, false));
    await act(async () => latest().syncCardActivationState(CardStatus.INACTIVE, true));

    expect(latest().cardActivated).toBe(false);
  });

  it('marks the replacement activated once it is issued', async () => {
    const latest = await mount();

    await act(async () => latest().syncCardActivationState(CardStatus.INACTIVE, true));
    expect(latest().cardActivated).toBe(false);

    await act(async () => latest().syncCardActivationState(CardStatus.ACTIVE, false));
    expect(latest().cardActivated).toBe(true);
  });
});
