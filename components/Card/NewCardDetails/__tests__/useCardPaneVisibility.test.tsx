import React, { useLayoutEffect } from 'react';

import {
  CLOSE_SETTLE_MS,
  useCardPaneVisibility,
} from '@/components/Card/NewCardDetails/useCardPaneVisibility';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

let root: ReturnType<typeof create>;
let commits: boolean[];

function Probe({ isOpen }: { isOpen: boolean }) {
  const isVisible = useCardPaneVisibility(isOpen);
  // Observe every committed render, including the one before passive effects.
  useLayoutEffect(() => {
    commits.push(isVisible);
  });
  return null;
}

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  commits = [];
  act(() => {
    root = create(<Probe isOpen={false} />);
  });
});

afterEach(() => {
  act(() => root.unmount());
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('stays hidden before the first opening', () => {
  act(() => jest.advanceTimersByTime(CLOSE_SETTLE_MS));
  expect(commits.every(visible => !visible)).toBe(true);
});

it('never hides for a commit between pressing back and finishing the exit', () => {
  act(() => root.update(<Probe isOpen />));
  commits = [];
  act(() => root.update(<Probe isOpen={false} />));
  act(() => jest.advanceTimersByTime(CLOSE_SETTLE_MS - 1));
  expect(commits.length).toBeGreaterThan(0);
  expect(commits.every(Boolean)).toBe(true);
  act(() => jest.advanceTimersByTime(1));
  expect(commits.at(-1)).toBe(false);
});

it('cancels the previous dismissal when reopened and retains the next exit', () => {
  act(() => root.update(<Probe isOpen />));
  act(() => root.update(<Probe isOpen={false} />));
  act(() => jest.advanceTimersByTime(200));
  act(() => root.update(<Probe isOpen />));
  commits = [];
  act(() => jest.advanceTimersByTime(CLOSE_SETTLE_MS));
  act(() => root.update(<Probe isOpen={false} />));
  act(() => jest.advanceTimersByTime(CLOSE_SETTLE_MS - 1));
  expect(commits.every(Boolean)).toBe(true);
  act(() => jest.advanceTimersByTime(1));
  expect(commits.at(-1)).toBe(false);
});
