import {
  DESKTOP_LAYOUT,
  inviteCardWidth,
  inviteTitleScale,
  MOBILE_LAYOUT,
} from '@/components/Invite/inviteLayout';

const V4_TITLE = 'Get $10 to spend\nwith your card';

describe('inviteTitleScale', () => {
  it('keeps the frames’ sizes at the frames’ widths', () => {
    // Desktop 1440: a 560pt column. Mobile 390: the column is the width less 20pt a side.
    expect(inviteTitleScale(DESKTOP_LAYOUT, 560, V4_TITLE)).toBe(1);
    expect(inviteTitleScale(MOBILE_LAYOUT, 350, V4_TITLE)).toBe(1);
  });

  it('shrinks the headline on a narrow phone so each line still fits', () => {
    const column = 280; // a 320pt phone
    const scale = inviteTitleScale(MOBILE_LAYOUT, column, V4_TITLE);

    expect(scale).toBeLessThan(1);
    // The longest line, at the frames' measured 0.464em a character, now fits the column.
    expect('Get $10 to spend'.length * 0.464 * MOBILE_LAYOUT.title.fontSize * scale).toBeLessThan(
      column,
    );
  });

  it('measures the longest line, not the whole headline', () => {
    expect(inviteTitleScale(MOBILE_LAYOUT, 350, 'Welcome to Solid')).toBe(1);
    expect(
      inviteTitleScale(MOBILE_LAYOUT, 350, 'Get $20 when you\nspend with your card'),
    ).toBeLessThan(1);
  });
});

describe('inviteCardWidth', () => {
  it('is the frames’ card on screens wide enough for it', () => {
    expect(inviteCardWidth(DESKTOP_LAYOUT, 1440)).toBe(540);
    expect(inviteCardWidth(MOBILE_LAYOUT, 390)).toBe(350);
    expect(inviteCardWidth(MOBILE_LAYOUT, 430)).toBe(350);
  });

  it('fits the column on a narrow phone', () => {
    expect(inviteCardWidth(MOBILE_LAYOUT, 320)).toBe(280);
  });
});
