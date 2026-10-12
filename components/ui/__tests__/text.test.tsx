import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { cssToReactNativeRuntime } from 'react-native-css-interop/dist/css-to-rn';
import { StyleSheet as NativeWindStyleSheet } from 'nativewind';

import { Text, TextClassContext, TextClassOverrideContext } from '@/components/ui/text';

// Keep the typography test independent of the wallet clients re-exported by lib/utils.
jest.mock('@/lib/utils', () => {
  const { clsx } = jest.requireActual('clsx');
  const { twMerge } = jest.requireActual('tailwind-merge');
  return { cn: (...classes: unknown[]) => twMerge(clsx(classes)) };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

let tree: ReturnType<typeof create>;
const renderedStyle = () => StyleSheet.flatten(tree.root.findByType('Text').props.style);

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  NativeWindStyleSheet.registerCompiled(
    cssToReactNativeRuntime(`
      .balance-label { font-size: 16px; line-height: 16px; font-family: MonaSans_400Regular; }
      .button-size { font-size: 20px; }
      .button-override { font-size: 16px; }
    `),
  );
});

afterEach(() => {
  act(() => tree?.unmount());
  jest.restoreAllMocks();
});

test.each(['ios', 'android'] as const)(
  '%s supplies a compact line height after resolving NativeWind classes',
  platform => {
    jest.replaceProperty(Platform, 'OS', platform);
    act(() => {
      tree = create(<Text className="balance-label">Your USD balance</Text>);
    });
    expect(renderedStyle()).toMatchObject({ fontSize: 16, fontFamily: 'MonaSans_400Regular' });
    expect(renderedStyle().lineHeight).toBe(20);
  },
);

test('handles inline style arrays and keeps accessibility and tap behavior', () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  const onPress = jest.fn();
  act(() => {
    tree = create(
      <Text
        style={[
          { fontSize: 14, lineHeight: 14 },
          { fontSize: 24, lineHeight: 24, color: 'white' },
        ]}
        accessibilityLabel="USD balance"
        onPress={onPress}
        numberOfLines={1}
      >
        $5.00
      </Text>,
    );
  });
  expect(renderedStyle()).toMatchObject({ fontSize: 24, color: 'white' });
  expect(renderedStyle().lineHeight).toBe(29);
  const label = tree.root.findByType('Text');
  expect(label.props.accessibilityLabel).toBe('USD balance');
  expect(label.props.numberOfLines).toBe(1);
  act(() => label.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('preserves a line height that already accommodates the font', () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  act(() => {
    tree = create(
      <Text style={{ fontFamily: 'MonaSans_400Regular', fontSize: 14, lineHeight: 21 }}>Safe</Text>,
    );
  });
  expect(renderedStyle().lineHeight).toBe(21);
});

test('uses inherited native font metrics for inline links', () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  act(() => {
    tree = create(
      <Text style={{ fontFamily: 'MonaSans_400Regular', fontSize: 16, lineHeight: 18 }}>
        Details <Text style={{ lineHeight: 18, textDecorationLine: 'underline' }}>Learn more</Text>
      </Text>,
    );
  });
  const labels = tree.root.findAllByType('Text');
  expect(labels).toHaveLength(2);
  expect(StyleSheet.flatten(labels[0].props.style).lineHeight).toBe(20);
  expect(StyleSheet.flatten(labels[1].props.style)).toMatchObject({
    textDecorationLine: 'underline',
  });
  expect(StyleSheet.flatten(labels[1].props.style).lineHeight).toBe(20);
});

test.each([
  { fontSize: 18, lineHeight: 25, expected: 25 },
  { fontSize: 14, lineHeight: 14, expected: 17 },
  { fontSize: 16, lineHeight: 20, expected: 20 },
  { fontSize: 24, lineHeight: 28, expected: 29 },
  { fontSize: 14, lineHeight: 18, expected: 18 },
])(
  'keeps the spend-mode and inline-link line boxes compact: $fontSize/$lineHeight',
  ({ fontSize, lineHeight, expected }) => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    act(() => {
      tree = create(
        <Text style={{ fontFamily: 'MonaSans_400Regular', fontSize, lineHeight }}>Cash $5.00</Text>,
      );
    });
    expect(renderedStyle().lineHeight).toBe(expected);
  },
);

test('respects the final button text override when checking line height', () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  act(() => {
    tree = create(
      <TextClassContext.Provider value="button-size">
        <TextClassOverrideContext.Provider value="button-override">
          <Text style={{ lineHeight: 20 }}>Add funds</Text>
        </TextClassOverrideContext.Provider>
      </TextClassContext.Provider>,
    );
  });
  expect(renderedStyle()).toMatchObject({ fontSize: 16, lineHeight: 20 });
});

test('keeps browser typography unchanged', () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  act(() => {
    tree = create(<Text style={{ fontSize: 16, lineHeight: 16 }}>Your USD balance</Text>);
  });
  expect(renderedStyle()).toMatchObject({ fontSize: 16, lineHeight: 16 });
});
