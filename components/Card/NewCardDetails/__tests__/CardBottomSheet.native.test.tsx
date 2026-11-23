import { createElement } from 'react';

import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet.native';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const mockPresent = jest.fn();
const mockDismiss = jest.fn();

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('@gorhom/bottom-sheet', () => {
  const { createElement, forwardRef, useImperativeHandle } = jest.requireActual('react');
  return {
    BottomSheetModal: forwardRef(({ onAnimate, onChange, onDismiss, children }: any, ref: any) => {
      useImperativeHandle(ref, () => ({ present: mockPresent, dismiss: mockDismiss }));
      return createElement('TestBottomSheet', { onAnimate, onChange, onDismiss }, children);
    }),
    BottomSheetView: 'BottomSheetView',
  };
});

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
});

const sheet = (onOpenChange: (open: boolean) => void, isSuspended = false) => (
  <CardBottomSheet
    isOpen
    isSuspended={isSuspended}
    onOpenChange={onOpenChange}
    contentKey="spend-mode"
    designTop={50}
    designBottom={57}
  >
    {({ session }) => createElement('SheetBody', { session })}
  </CardBottomSheet>
);

test('resumes after an interrupted native suspension without closing the drawer session', () => {
  const onOpenChange = jest.fn();

  let tree: ReturnType<typeof create>;
  act(() => {
    tree = create(sheet(onOpenChange));
  });
  try {
    expect(mockPresent).toHaveBeenCalledTimes(1);
    act(() => tree.root.findByType('TestBottomSheet').props.onChange(0));
    const session = tree.root.findByType('SheetBody').props.session;
    act(() => tree.update(sheet(onOpenChange, true)));
    expect(mockDismiss).toHaveBeenCalledWith({ duration: 0 });

    act(() => tree.update(sheet(onOpenChange)));
    expect(mockPresent).toHaveBeenCalledTimes(1);
    const dismiss = () => act(() => tree.root.findByType('TestBottomSheet').props.onDismiss());
    dismiss();
    expect(mockPresent).toHaveBeenCalledTimes(2);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(tree.root.findByType('SheetBody').props.session).toBe(session);

    dismiss();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  } finally {
    act(() => tree.unmount());
  }
});

test('dismisses a deferred native presentation as soon as opening starts during suspension', () => {
  const onOpenChange = jest.fn();
  let tree: ReturnType<typeof create>;
  act(() => {
    tree = create(sheet(onOpenChange));
  });
  try {
    act(() => tree.update(sheet(onOpenChange, true)));
    expect(mockDismiss).not.toHaveBeenCalled();

    act(() => tree.root.findByType('TestBottomSheet').props.onAnimate(-1, 0));
    expect(mockDismiss).toHaveBeenCalledWith({ duration: 0 });
    act(() => tree.root.findByType('TestBottomSheet').props.onDismiss());
    expect(mockPresent).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();

    act(() => tree.update(sheet(onOpenChange)));
    expect(mockPresent).toHaveBeenCalledTimes(2);
  } finally {
    act(() => tree.unmount());
  }
});
