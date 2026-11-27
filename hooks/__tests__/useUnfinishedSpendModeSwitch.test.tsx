import React from 'react';

import {
  isSpendModeSwitchUnfinished,
  useUnfinishedSpendModeSwitch,
} from '@/hooks/useUnfinishedSpendModeSwitch';

const { act, create } = jest.requireActual('react-test-renderer');

let mockRegistration: any;
let mockBaseMode: any;
const mockUseBaseSpendMode = jest.fn();
jest.mock('@/hooks/useCardSpendRegistration', () => ({
  useCardSpendRegistration: () => mockRegistration,
}));
jest.mock('@/hooks/useCardCreditPositions', () => ({
  useBaseSpendMode: (options: any) => {
    mockUseBaseSpendMode(options);
    return mockBaseMode;
  },
}));

let result: ReturnType<typeof useUnfinishedSpendModeSwitch>;
const Probe = () => {
  const current = useUnfinishedSpendModeSwitch();
  React.useEffect(() => {
    result = current;
  }, [current]);
  return null;
};
const read = () => {
  let root: any;
  act(() => {
    root = create(<Probe />);
  });
  act(() => root.unmount());
  return result;
};

beforeEach(() => {
  mockUseBaseSpendMode.mockClear();
  mockRegistration = { mode: 'credit', pendingMode: null, canChangeMode: true };
  mockBaseMode = { mode: 'cash', isLoading: false, isError: false };
});

test('reports a switch that reached Fuse and not Base', () => {
  expect(read()).toEqual({ mode: 'credit', baseMode: 'cash' });
});

test('reports nothing when both sides hold the same mode', () => {
  mockBaseMode = { mode: 'credit', isLoading: false, isError: false };
  expect(read()).toBeNull();
});

test('reports nothing while Base has not answered or could not be read', () => {
  mockBaseMode = { mode: null, isLoading: true, isError: false };
  expect(read()).toBeNull();
  mockBaseMode = { mode: null, isLoading: false, isError: true };
  expect(read()).toBeNull();
});

test('reports nothing while a Fuse switch is still armed', () => {
  mockRegistration = { mode: 'cash', pendingMode: 'credit', canChangeMode: true };
  mockBaseMode = { mode: 'credit', isLoading: false, isError: false };
  expect(read()).toBeNull();
});

test('does not read Base for a cardholder who cannot change mode', () => {
  mockRegistration = { mode: 'cash', pendingMode: null, canChangeMode: false };
  mockBaseMode = { mode: null, isLoading: false, isError: false };
  expect(read()).toBeNull();
  expect(mockUseBaseSpendMode).toHaveBeenLastCalledWith({ enabled: false });
});

test('isSpendModeSwitchUnfinished', () => {
  expect(isSpendModeSwitchUnfinished('credit', 'cash', null)).toBe(true);
  expect(isSpendModeSwitchUnfinished('smart', 'smart', null)).toBe(false);
  expect(isSpendModeSwitchUnfinished('credit', null, null)).toBe(false);
  expect(isSpendModeSwitchUnfinished('cash', 'credit', 'credit')).toBe(false);
});
