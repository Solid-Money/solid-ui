/** Shared diameter for circular header and popup controls. */
export const CIRCULAR_CONTROL_SIZE = 50;

export const CIRCULAR_CONTROL_CLASS_NAME = 'h-[50px] w-[50px] shrink-0';

export const CIRCULAR_CONTROL_STYLE = {
  width: CIRCULAR_CONTROL_SIZE,
  height: CIRCULAR_CONTROL_SIZE,
  borderRadius: CIRCULAR_CONTROL_SIZE / 2,
  flexShrink: 0,
} as const;
