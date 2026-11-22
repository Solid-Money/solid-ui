import { createElement } from 'react';
import { StyleSheet } from 'react-native';

import {
  balancePanelHasTitle,
  balancePanelHeight,
  CREDIT_PANEL_HEIGHT,
  SpendModeCreditPanel,
} from '@/components/Card/NewCardDetails/SpendMode/SpendModePanels';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/lib/assets', () => ({ getAsset: jest.fn() }));

/** 23 + 50 header, 16 below. */
const BALANCE_BARE = 23 + 50 + 16;
/** The divider (27) and the "Spends in this order" title (34). */
const BALANCE_TITLE = 27 + 34;
describe('balance panel', () => {
  it('keeps the title, and so "Edit order", with no row when the order can be edited', () => {
    expect(balancePanelHasTitle(0, true)).toBe(true);
    expect(balancePanelHasTitle(0, false)).toBe(false);
    expect(balancePanelHasTitle(2, false)).toBe(true);
  });

  it('sizes the empty panel with and without its title', () => {
    expect(balancePanelHeight([])).toBe(BALANCE_BARE);
    expect(balancePanelHeight([], false)).toBe(BALANCE_BARE);
    expect(balancePanelHeight([], true)).toBe(BALANCE_BARE + BALANCE_TITLE);
  });

  it('sizes a populated panel as before', () => {
    const rows = [{ subtitle: undefined, detail: undefined }, { subtitle: 'Fuse' }];
    expect(balancePanelHeight(rows)).toBe(BALANCE_BARE + BALANCE_TITLE + 48 + 56);
    expect(balancePanelHeight(rows, true)).toBe(balancePanelHeight(rows));
  });
});

describe('credit panel', () => {
  it('reserves only the borrowed summary, divider and Credit details link', () => {
    expect(CREDIT_PANEL_HEIGHT).toBe(119 + 1 + 48);
  });

  it('makes the borrowed summary and footer a single button', () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const onViewDetails = jest.fn();
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(
        createElement(SpendModeCreditPanel, {
          borrowed: '$400',
          creditLimit: '$1,000',
          borrowApy: '4.00%',
          borrowedProgress: 0.4,
          risk: 'none',
          hasDebt: true,
          onViewDetails,
        }),
      );
    });
    try {
      expect(
        tree.root
          .findAllByType('Text')
          .map((node: { children: string[] }) => node.children.join('')),
      ).toEqual(['Borrowed', '$400 / $1,000', 'at 4.00% APY', 'Healthy', 'View Credit details']);
      const detailsButton = tree.root.findAllByProps({
        accessibilityLabel: 'View Credit details',
      })[0];
      expect(detailsButton.props.accessibilityRole).toBe('button');
      expect(StyleSheet.flatten(detailsButton.props.style).height).toBe(CREDIT_PANEL_HEIGHT);
      act(() => detailsButton.props.onPress());
      expect(onViewDetails).toHaveBeenCalledTimes(1);
    } finally {
      act(() => tree.unmount());
    }
  });
});
