import React from 'react';

import { AiApiLimitOptions } from '@/components/AiApi/AiApiPrimitives';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * The monthly limit pills: the picked one is white, so its label has to turn
 * black. The colour is an inline style, because on the web toggled classes
 * left the label white on white.
 */

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => String(name) }));
jest.mock('expo-clipboard', () => ({}));
jest.mock('@/components/Card/NewCardDetails/icons', () => ({
  CheckIcon: 'CheckIcon',
  CopyIcon: 'CopyIcon',
}));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
// Its barrel reaches wagmi's ESM build, which does not load under jest-expo.
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

const labelColors = (tree: any) =>
  Object.fromEntries(
    tree.root
      .findAllByType('Text')
      .map((text: any) => [text.props.children, text.props.style.color]),
  );

describe('AiApiLimitOptions', () => {
  it('keeps the picked pill readable when the choice changes', () => {
    const options = [25, 50, 100, 250];
    const render = (value: number, custom = false) => (
      <AiApiLimitOptions
        options={options}
        value={value}
        custom={custom}
        onSelect={jest.fn()}
        onCustom={jest.fn()}
      />
    );

    let tree: any;
    act(() => {
      tree = create(render(50));
    });
    expect(labelColors(tree)).toMatchObject({ $50: '#000000', $100: '#FFFFFF' });

    act(() => {
      tree.update(render(100));
    });
    expect(labelColors(tree)).toMatchObject({ $50: '#FFFFFF', $100: '#000000' });

    act(() => {
      tree.update(render(100, true));
    });
    expect(labelColors(tree)).toMatchObject({ $100: '#FFFFFF', Custom: '#000000' });
  });

  it('does not put the label colour in its classes', () => {
    let tree: any;
    act(() => {
      tree = create(
        <AiApiLimitOptions options={[25]} value={25} onSelect={jest.fn()} onCustom={jest.fn()} />,
      );
    });
    for (const text of tree.root.findAllByType('Text')) {
      expect(text.props.className).not.toMatch(/text-(black|white)/);
    }
  });
});
