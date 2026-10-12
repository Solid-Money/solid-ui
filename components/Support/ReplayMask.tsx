import { ComponentType, ReactNode } from 'react';
import { UIManager, View, ViewProps } from 'react-native';

type MaskViewProps = ViewProps & { mask: 'amp-mask' | 'amp-unmask' | 'amp-block' };

let MaskView: ComponentType<MaskViewProps> | null | undefined;

/** Amplitude's native mask view, when this binary has it; a plain View otherwise. */
const resolveMaskView = () => {
  if (MaskView !== undefined) return MaskView;
  try {
    const registered =
      typeof UIManager.hasViewManagerConfig === 'function'
        ? UIManager.hasViewManagerConfig('RCTAmpMaskView')
        : false;
    MaskView = registered
      ? // eslint-disable-next-line @typescript-eslint/no-require-imports
        (require('@amplitude/plugin-session-replay-react-native')
          .AmpMaskView as ComponentType<MaskViewProps>)
      : null;
  } catch {
    MaskView = null;
  }
  return MaskView;
};

/**
 * Keeps the support chat out of session replays. A conversation holds
 * account details, ID photos and receipts, and replays are sampled for
 * product analytics, so the whole chat is blocked, not just masked.
 */
export default function ReplayMask({
  children,
  style,
  ...props
}: ViewProps & { children: ReactNode }) {
  const Mask = resolveMaskView();
  if (!Mask) {
    return (
      <View style={style} {...props}>
        {children}
      </View>
    );
  }
  return (
    <Mask mask="amp-block" style={style} {...props}>
      {children}
    </Mask>
  );
}
