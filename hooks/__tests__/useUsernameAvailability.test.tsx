import React, { useEffect } from 'react';

import {
  USERNAME_TAKEN_FALLBACK,
  UsernameAvailability,
  useUsernameAvailability,
} from '@/hooks/useUsernameAvailability';
import { checkUsernameAvailability } from '@/lib/api';

// react-test-renderer is supplied by jest-expo without bundled declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/lib/api', () => ({ checkUsernameAvailability: jest.fn() }));

const check = checkUsernameAvailability as jest.Mock;

let availability: UsernameAvailability;
let root: ReturnType<typeof create>;

function Harness({ value, skip }: { value: string; skip?: boolean }) {
  const result = useUsernameAvailability(value, { skip });
  useEffect(() => {
    availability = result;
  });
  return null;
}

/** Render, then let the debounce elapse and the reply settle. */
const render = async (value: string, skip = false) => {
  await act(async () => {
    root = create(<Harness value={value} skip={skip} />);
  });
};

const rerender = async (value: string, skip = false) => {
  await act(async () => {
    root.update(<Harness value={value} skip={skip} />);
  });
};

const settle = async () => {
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  check.mockReset();
  check.mockResolvedValue({ available: true });
});

afterEach(() => {
  jest.useRealTimers();
});

it('says nothing, and asks nothing, about a name that is not yet well-formed', async () => {
  await render('ab');

  expect(availability).toEqual({ status: 'idle' });
  await settle();
  expect(check).not.toHaveBeenCalled();
});

it('reports the handle free once typing settles', async () => {
  await render('countess');

  // Shown while the answer is outstanding, so the field is never silently
  // ahead of the check.
  expect(availability).toEqual({ status: 'checking' });

  await settle();

  expect(check).toHaveBeenCalledWith('countess');
  expect(availability).toEqual({ status: 'available' });
});

it('checks the normalised handle, not what was typed', async () => {
  await render('  Countess  ');
  await settle();

  expect(check).toHaveBeenCalledWith('countess');
});

it("passes on the server's reason for refusing a handle", async () => {
  check.mockResolvedValue({ available: false, reason: 'Username "admin" is reserved' });

  await render('admin');
  await settle();

  expect(availability).toEqual({
    status: 'unavailable',
    reason: 'Username "admin" is reserved',
  });
});

it('still names the problem when the server gives no reason', async () => {
  check.mockResolvedValue({ available: false });

  await render('countess');
  await settle();

  expect(availability).toEqual({ status: 'unavailable', reason: USERNAME_TAKEN_FALLBACK });
});

it('checks a typed-out name once rather than per keystroke', async () => {
  await render('coun');
  await rerender('count');
  await rerender('countess');
  await settle();

  expect(check).toHaveBeenCalledTimes(1);
  expect(check).toHaveBeenCalledWith('countess');
});

it('does not let a superseded answer land on a newer name', async () => {
  // The reply for "countess" arrives after the user has moved on to "ada": it
  // must not mark the name now in the field as taken.
  let resolveFirst: (value: { available: boolean; reason?: string }) => void = () => {};
  check.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveFirst = resolve;
      }),
  );

  await render('countess');
  await act(async () => {
    jest.advanceTimersByTime(400);
  });

  await rerender('ada.lovelace');
  await act(async () => {
    resolveFirst({ available: false, reason: 'taken' });
  });

  expect(availability.status).not.toBe('unavailable');

  await settle();
  expect(availability).toEqual({ status: 'available' });
});

it('does not block the form when the check cannot be reached', async () => {
  // The request that actually claims the name validates it again and is the
  // real gate, so an unreachable check is not the user's problem.
  check.mockRejectedValue(new Error('offline'));

  await render('countess');
  await settle();

  expect(availability).toEqual({ status: 'idle' });
});

it('never asks about a name the caller is told to skip', async () => {
  // The rename screen skips the account's own current handle: the endpoint is
  // public and would answer "taken" for it.
  await render('countess', true);
  await settle();

  expect(check).not.toHaveBeenCalled();
  expect(availability).toEqual({ status: 'idle' });
});
