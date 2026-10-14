import {
  AVATAR_COLORS,
  DEFAULT_AVATAR_COLOR_ID,
  getAvatarColor,
  getAvatarInitial,
} from '@/components/Profile/avatarColors';

describe('getAvatarColor', () => {
  it('returns the swatch that was picked', () => {
    expect(getAvatarColor('green').id).toBe('green');
  });

  it('falls back to the default for nothing picked or a retired swatch', () => {
    expect(getAvatarColor(undefined).id).toBe(DEFAULT_AVATAR_COLOR_ID);
    expect(getAvatarColor('teal').id).toBe(DEFAULT_AVATAR_COLOR_ID);
  });

  it('offers eight distinct swatches', () => {
    expect(new Set(AVATAR_COLORS.map(color => color.id)).size).toBe(8);
  });
});

describe('getAvatarInitial', () => {
  it('uses the first character, capitalised', () => {
    expect(getAvatarInitial('smargon4')).toBe('S');
    expect(getAvatarInitial('  eli@fuse.io')).toBe('E');
  });

  it('shows a placeholder when there is no name', () => {
    expect(getAvatarInitial('')).toBe('?');
    expect(getAvatarInitial(undefined)).toBe('?');
  });
});
