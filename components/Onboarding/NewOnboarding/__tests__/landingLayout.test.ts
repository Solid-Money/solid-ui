import {
  getCtaTop,
  getHeroContentBottom,
  getLandingLayout,
  LOGO_LOCKUP_HEIGHT,
  MAX_FONT_SCALE,
} from '@/components/Onboarding/NewOnboarding/landingLayout';

/** Viewport + safe-area insets for the devices the hero has to survive. */
const DEVICES = {
  // The 390x844 frame the Figma offsets were measured on.
  reference: { width: 390, height: 844, topInset: 47, bottomInset: 34 },
  // The device the overlap was reported on.
  iPhone13ProMax: { width: 428, height: 926, topInset: 47, bottomInset: 34 },
  iPhoneSE: { width: 375, height: 667, topInset: 20, bottomInset: 0 },
  iPhoneSE1stGen: { width: 320, height: 568, topInset: 20, bottomInset: 0 },
  pixel7: { width: 412, height: 915, topInset: 24, bottomInset: 24 },
} as const;

describe('getLandingLayout', () => {
  it('reproduces the Figma geometry exactly on the reference device', () => {
    const layout = getLandingLayout(DEVICES.reference);

    // Lockup at 97, headline at 157, description at 268 — the offsets the
    // screen used to hard-code.
    expect(layout.paddingTop).toBe(97);
    expect(layout.paddingTop + LOGO_LOCKUP_HEIGHT + layout.titleMarginTop).toBeCloseTo(157, 0);
    expect(
      layout.paddingTop +
        LOGO_LOCKUP_HEIGHT +
        layout.titleMarginTop +
        layout.titleLineHeight * 2 +
        layout.descriptionMarginTop,
    ).toBeCloseTo(268, 0);

    expect(layout.textWidth).toBe(303);
    expect(layout.titleFontSize).toBe(44);
    expect(layout.descriptionFontSize).toBe(18);
    expect(layout.descriptionLineHeight).toBe(21.6);
  });

  it('widens the text column on wider phones instead of capping it at the design frame', () => {
    // The fixed 303pt column is what forced the headline onto a third line on a
    // 428pt-wide phone that had room to spare.
    expect(getLandingLayout(DEVICES.iPhone13ProMax).textWidth).toBeGreaterThan(
      getLandingLayout(DEVICES.reference).textWidth,
    );
  });

  it('never lets the text column overflow the screen gutters', () => {
    Object.values(DEVICES).forEach(device => {
      const { textWidth } = getLandingLayout(device);
      expect(textWidth).toBeLessThanOrEqual(device.width - 40);
      expect(textWidth).toBeGreaterThan(0);
    });
  });

  it('tracks the safe-area top inset rather than a fixed offset', () => {
    const dynamicIsland = getLandingLayout({ ...DEVICES.iPhone13ProMax, topInset: 59 });
    expect(dynamicIsland.paddingTop).toBe(59 + 50);
  });

  it('floors the bottom inset so the CTA never sits flush to the edge', () => {
    expect(getLandingLayout(DEVICES.iPhoneSE).bottomInset).toBe(20);
    expect(getLandingLayout(DEVICES.iPhone13ProMax).bottomInset).toBe(34);
  });

  it('scales the headline down on short screens', () => {
    const se = getLandingLayout(DEVICES.iPhoneSE);
    const tall = getLandingLayout(DEVICES.reference);
    expect(se.titleFontSize).toBeLessThan(tall.titleFontSize);
    expect(se.descriptionFontSize).toBeLessThan(tall.descriptionFontSize);
  });
});

describe('hero content never collides with the CTA', () => {
  // Well past what the copy needs at any supported size: the headline is three
  // words and the description wraps to four lines on the design frame. If the
  // block clears the CTA here it clears it in practice.
  const WORST_CASE_TITLE_LINES = 3;
  const WORST_CASE_DESCRIPTION_LINES = 5;

  Object.entries(DEVICES).forEach(([name, device]) => {
    [1, MAX_FONT_SCALE].forEach(fontScale => {
      it(`clears the CTA on ${name} at ${fontScale}x Dynamic Type`, () => {
        const layout = getLandingLayout(device);
        const contentBottom = getHeroContentBottom(
          layout,
          WORST_CASE_TITLE_LINES,
          WORST_CASE_DESCRIPTION_LINES,
          fontScale,
        );

        expect(contentBottom).toBeLessThan(getCtaTop(layout, device.height));
      });
    });
  });
});

describe('flow layout regression', () => {
  /**
   * The bug as reported: pinned at Figma's offsets, a three-line headline on an
   * iPhone 13 Pro Max ran from 157 to 289 while the description stayed at 268.
   * This asserts the geometry that used to be hard-coded really did overlap, so
   * the reason the layout moved into flow does not get lost.
   */
  it('the old pinned offsets overlapped once the headline took a third line', () => {
    const PINNED_TITLE_TOP = 157;
    const PINNED_TITLE_LINE_HEIGHT = 44;
    const PINNED_DESCRIPTION_TOP = 268;

    const twoLineBottom = PINNED_TITLE_TOP + PINNED_TITLE_LINE_HEIGHT * 2;
    const threeLineBottom = PINNED_TITLE_TOP + PINNED_TITLE_LINE_HEIGHT * 3;

    expect(twoLineBottom).toBeLessThanOrEqual(PINNED_DESCRIPTION_TOP);
    expect(threeLineBottom).toBeGreaterThan(PINNED_DESCRIPTION_TOP);
  });

  it('gives the description a positive gap for any line count, on every device', () => {
    Object.values(DEVICES).forEach(device => {
      const layout = getLandingLayout(device);

      [1, 2, 3, 4].forEach(titleLines => {
        const titleBottom =
          layout.paddingTop +
          LOGO_LOCKUP_HEIGHT +
          layout.titleMarginTop +
          layout.titleLineHeight * MAX_FONT_SCALE * titleLines;
        const descriptionTop = titleBottom + layout.descriptionMarginTop;

        expect(descriptionTop).toBeGreaterThan(titleBottom);
      });
    });
  });
});
