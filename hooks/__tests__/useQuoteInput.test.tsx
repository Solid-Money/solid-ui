import React, { useEffect } from 'react';

import { QUOTE_DEBOUNCE_MS, useQuoteInput } from '@/hooks/swap/useQuoteInput';
import { SwapField, SwapFieldType } from '@/lib/types/swap-field';
// react-test-renderer is supplied by jest-expo without bundled declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

let input: ReturnType<typeof useQuoteInput>;
let root: ReturnType<typeof create>;

function Harness({ field, value }: { field: SwapFieldType; value: string }) {
  const result = useQuoteInput(field, value);
  useEffect(() => {
    input = result;
  });
  return null;
}

const render = (value: string, field: SwapFieldType = SwapField.INPUT) =>
  act(() => {
    if (root) root.update(<Harness field={field} value={value} />);
    else root = create(<Harness field={field} value={value} />);
  });
const wait = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  root = undefined;
});
afterEach(() => {
  act(() => root?.unmount());
  jest.useRealTimers();
});

it('quotes a typed amount only once typing pauses', () => {
  render('1');
  render('10');
  expect(input).toMatchObject({ typedValue: '1', pending: true });

  wait(QUOTE_DEBOUNCE_MS - 1);
  expect(input).toMatchObject({ typedValue: '1', pending: true });

  wait(1);
  expect(input).toMatchObject({ typedValue: '10', pending: false });
});

it('restarts the wait on every keystroke', () => {
  render('1');
  render('10');
  wait(QUOTE_DEBOUNCE_MS - 50);
  render('100');
  wait(QUOTE_DEBOUNCE_MS - 50);
  expect(input).toMatchObject({ typedValue: '1', pending: true });

  wait(50);
  expect(input).toMatchObject({ typedValue: '100', pending: false });
});

it('drops a cleared amount at once', () => {
  render('100');
  render('');
  expect(input).toMatchObject({ typedValue: '', pending: false });
});

it('does not wait when the pair flips and the amount moves to the other side', () => {
  render('100');
  render('100', SwapField.OUTPUT);
  expect(input).toMatchObject({
    independentField: SwapField.OUTPUT,
    typedValue: '100',
    pending: false,
  });
});

it('keeps quoting the old field while an amount typed into the other one waits', () => {
  render('100');
  render('5', SwapField.OUTPUT);
  expect(input).toMatchObject({
    independentField: SwapField.INPUT,
    typedValue: '100',
    pending: true,
  });

  wait(QUOTE_DEBOUNCE_MS);
  expect(input).toMatchObject({
    independentField: SwapField.OUTPUT,
    typedValue: '5',
    pending: false,
  });
});
