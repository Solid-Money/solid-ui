import React from 'react';

import {
  CARD_STATUS_RETRY_MAX_MS,
  CARD_STATUS_RETRY_MS,
  useCardStatusReadiness,
} from '@/hooks/useCardStatusReadiness';

const { act, create } = jest.requireActual('react-test-renderer');

/**
 * A card link (`?screen=card-info`) waits until the card status is known, so
 * a card the Rain sunset closed goes to its own screen rather than the card
 * pane. These cover when the status counts as known, and how a failed read
 * is retried while a link waits on it.
 */
type Query = Parameters<typeof useCardStatusReadiness>[0];

let known: boolean;
let root: any;
const refetch = jest.fn(() => Promise.resolve());

function Probe({ query, waiting }: { query: Query; waiting: boolean }) {
  const value = useCardStatusReadiness(query, waiting);
  React.useEffect(() => {
    known = value;
  }, [value]);
  return null;
}

const query = (overrides: Partial<Query> = {}): Query =>
  ({
    data: undefined,
    isEnabled: true,
    isError: false,
    errorUpdatedAt: 0,
    refetch,
    ...overrides,
  }) as Query;

const render = (q: Query, waiting = true) => {
  act(() => {
    if (root) root.update(<Probe query={q} waiting={waiting} />);
    else root = create(<Probe query={q} waiting={waiting} />);
  });
};

const advance = (ms: number) => {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  refetch.mockClear();
  root = undefined;
});

afterEach(() => {
  act(() => root?.unmount());
  jest.useRealTimers();
});

it('knows a status that has been read, no card included', () => {
  render(query({ data: null }));
  expect(known).toBe(true);
});

it('needs no status when there is no query to wait for (no user)', () => {
  render(query({ isEnabled: false }));
  expect(known).toBe(true);
});

it('does not know a status still loading, or paused offline, and leaves its fetch alone', () => {
  // Loading and paused offline look alike here: enabled, no data, no error.
  render(query());
  expect(known).toBe(false);
  advance(5 * 60_000);
  expect(refetch).not.toHaveBeenCalled();
});

it('reads a failed status again while a link waits, a little later each time', () => {
  render(query({ isError: true, errorUpdatedAt: 1 }));
  expect(known).toBe(false);
  advance(CARD_STATUS_RETRY_MS - 1);
  expect(refetch).not.toHaveBeenCalled();
  advance(1);
  expect(refetch).toHaveBeenCalledTimes(1);

  // The retry in flight is no longer an error, and not yet an answer: the
  // wait does not start over.
  render(query());
  render(query({ isError: true, errorUpdatedAt: 2 }));
  advance(2 * CARD_STATUS_RETRY_MS - 1);
  expect(refetch).toHaveBeenCalledTimes(1);
  advance(1);
  expect(refetch).toHaveBeenCalledTimes(2);

  render(query());
  render(query({ isError: true, errorUpdatedAt: 3 }));
  advance(4 * CARD_STATUS_RETRY_MS - 1);
  expect(refetch).toHaveBeenCalledTimes(2);
  advance(1);
  expect(refetch).toHaveBeenCalledTimes(3);

  // Then the status comes in.
  render(query({ data: null }));
  expect(known).toBe(true);
  advance(5 * 60_000);
  expect(refetch).toHaveBeenCalledTimes(3);
});

it('waits at most thirty seconds between reads', () => {
  for (let failure = 1; failure <= 6; failure++) {
    render(query({ isError: true, errorUpdatedAt: failure }));
    advance(CARD_STATUS_RETRY_MAX_MS);
    expect(refetch).toHaveBeenCalledTimes(failure);
  }
});

it('does not read again for no link, and starts over for the next one', () => {
  render(query({ isError: true, errorUpdatedAt: 1 }));
  advance(CARD_STATUS_RETRY_MS);
  render(query({ isError: true, errorUpdatedAt: 2 }));
  advance(2 * CARD_STATUS_RETRY_MS);
  expect(refetch).toHaveBeenCalledTimes(2);

  // The link is gone: nothing waits on the status.
  render(query({ isError: true, errorUpdatedAt: 3 }), false);
  advance(5 * 60_000);
  expect(refetch).toHaveBeenCalledTimes(2);

  // A new link: back to the first, short wait.
  render(query({ isError: true, errorUpdatedAt: 3 }), true);
  advance(CARD_STATUS_RETRY_MS);
  expect(refetch).toHaveBeenCalledTimes(3);
});
