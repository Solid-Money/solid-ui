import {
  balancePanelHasTitle,
  balancePanelHeight,
  BORROWED_PANEL_HEIGHT,
  creditPanelHasCollateral,
  creditPanelHeight,
} from '@/components/Card/NewCardDetails/SpendMode/SpendModePanels';

/** 23 + 50 header, 16 below. */
const BALANCE_BARE = 23 + 50 + 16;
/** The divider (27) and the "Spends in this order" title (34). */
const BALANCE_TITLE = 27 + 34;
/** "View Credit details" and the divider over it. */
const CREDIT_FOOT = 1 + 52;
/** The borrowed block, its divider, and the collateral title with its padding. */
const CREDIT_COLLATERAL_BASE = 119 + 1 + 18 + 28 + 12;

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
  it('keeps the collateral title with no row only when the order can be edited', () => {
    expect(creditPanelHasCollateral(0, true, true)).toBe(true);
    expect(creditPanelHasCollateral(0, true, false)).toBe(false);
    expect(creditPanelHasCollateral(0, false, true)).toBe(false);
    expect(creditPanelHasCollateral(1, false, false)).toBe(true);
  });

  it('sizes the empty panel with and without the collateral title', () => {
    expect(creditPanelHeight(0)).toBe(BORROWED_PANEL_HEIGHT + CREDIT_FOOT);
    expect(creditPanelHeight(0, false)).toBe(BORROWED_PANEL_HEIGHT + CREDIT_FOOT);
    expect(creditPanelHeight(0, true)).toBe(CREDIT_COLLATERAL_BASE + CREDIT_FOOT);
  });

  it('sizes a populated panel as before, scrolling past three and a half rows', () => {
    expect(creditPanelHeight(2)).toBe(CREDIT_COLLATERAL_BASE + 2 * 58 + CREDIT_FOOT);
    expect(creditPanelHeight(6)).toBe(CREDIT_COLLATERAL_BASE + 3.5 * 58 + CREDIT_FOOT);
  });
});
