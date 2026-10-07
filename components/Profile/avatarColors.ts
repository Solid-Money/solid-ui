/**
 * The swatches the Edit avatar sheet offers, in the order it lays them out.
 *
 * Each is a tinted disc with the initial drawn in the full-strength colour, the
 * same recipe `getColorForTransaction` uses for merchant avatars so a profile
 * avatar reads as one of the family rather than a new style.
 */
export const AVATAR_COLORS = [
  { id: 'purple', bg: 'rgba(165,127,242,0.25)', text: '#A57FF2' },
  { id: 'blue', bg: 'rgba(127,200,242,0.25)', text: '#7FC8F2' },
  { id: 'green', bg: 'rgba(127,242,158,0.25)', text: '#7FF29E' },
  { id: 'gold', bg: 'rgba(242,194,127,0.25)', text: '#F2C27F' },
  { id: 'pink', bg: 'rgba(242,127,215,0.25)', text: '#F27FD7' },
  { id: 'red', bg: 'rgba(242,127,129,0.25)', text: '#F27F81' },
  { id: 'lime', bg: 'rgba(180,242,127,0.25)', text: '#B4F27F' },
  { id: 'gray', bg: 'rgba(189,189,189,0.25)', text: '#BDBDBD' },
] as const;

export type AvatarColorId = (typeof AVATAR_COLORS)[number]['id'];
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export const DEFAULT_AVATAR_COLOR_ID: AvatarColorId = 'purple';

/** The swatch for `id`, or the default when it is missing or no longer offered. */
export const getAvatarColor = (id: string | null | undefined): AvatarColor =>
  AVATAR_COLORS.find(color => color.id === id) ??
  AVATAR_COLORS.find(color => color.id === DEFAULT_AVATAR_COLOR_ID)!;

/** The letter on the avatar: the name's first character, `?` when there is none. */
export const getAvatarInitial = (name: string | null | undefined): string => {
  const first = name?.trim().charAt(0);
  return first ? first.toUpperCase() : '?';
};
