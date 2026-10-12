import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast, { ToastConfigParams, ToastShowParams } from 'react-native-toast-message';
import { Href, router } from 'expo-router';
import { Check, CircleAlert, Info, X } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { clampText, ERROR_COPY_LIMITS } from '@/lib/errors/copyLimits';
import { redactSecrets, sanitizeDisplayText } from '@/lib/utils/userFacingError';

/**
 * The app toast (Figma: UI 4 › Toasts & error states › Toast, Success / Info /
 * Error × Mobile / Web). Quick feedback that blocks nothing: copied, sent, card
 * frozen, a background refresh failed. A failed money action is never a toast;
 * it gets the failure sheet (`showFailureSheet`).
 *
 * - Mobile (and narrow web): top of the screen, safe-area top + 10, full width
 *   with 16px margins, swipe up to dismiss, no close button.
 * - Desktop web: bottom-right, 400px wide, 24px from the edges, close button.
 * - Title + at most two lines of body; at most one action.
 * - Hides after 5s, or 8s when it has an action.
 *
 * `Toast.show({ type, text1, text2, props })` stays the API, so existing call
 * sites keep working. `props.action` adds the action; `props.link` (+
 * `linkText`) still works and becomes a "View" action.
 */

export interface ToastAction {
  /** One or two words: Undo, View, Get help. */
  label: string;
  onPress: () => void;
}

export interface AppToastProps {
  action?: ToastAction;
  /** Shown as an action (label `linkText`, default "View") that opens it. */
  link?: Href;
  linkText?: string;
}

type ToastKind = 'success' | 'info' | 'error';

export const TOAST_DURATION_MS = 5000;
export const TOAST_WITH_ACTION_DURATION_MS = 8000;

const ICONS = { success: Check, info: Info, error: CircleAlert } as const;

/** Badge fill and glyph colour per type (brand green, white, destructive red). */
const TONES: Record<ToastKind, { badge: string; icon: string }> = {
  success: { badge: 'rgba(148, 242, 127, 0.14)', icon: '#94F27F' },
  info: { badge: 'rgba(255, 255, 255, 0.1)', icon: '#FFFFFF' },
  error: { badge: 'rgba(255, 101, 102, 0.14)', icon: '#FF6566' },
};

const openLink = (link: Href) => {
  if (typeof link === 'string' && /^https?:\/\//i.test(link)) {
    void Linking.openURL(link);
  } else {
    router.push(link);
  }
};

const resolveAction = (props?: AppToastProps): ToastAction | undefined => {
  if (props?.action) return props.action;
  const link = props?.link;
  if (!link) return undefined;
  // Older call sites pass a shortened tx hash or "View on Etherscan" as the link
  // text; the design's action label is one short word, so those become "View".
  const linkText = props?.linkText;
  const label =
    linkText && linkText.length <= ERROR_COPY_LIMITS.toastAction && !/0x[0-9a-f]/i.test(linkText)
      ? linkText
      : 'View';
  return { label, onPress: () => openLink(link) };
};

const hasAction = (props: unknown): boolean => Boolean(resolveAction(props as AppToastProps));

interface ToastViewProps {
  type: ToastKind;
  title?: string;
  body?: string;
  action?: ToastAction;
  onPress?: () => void;
  hide: () => void;
}

const ToastView = ({ type, title, body, action, onPress, hide }: ToastViewProps) => {
  const { isDesktop } = useDimension();
  const Icon = ICONS[type];
  const tone = TONES[type];
  // The last line of defence for a call site that still hands over a caught
  // `error.message`: never paint a credential, and on an error toast never a
  // developer dump. Success and info bodies keep tx hashes and addresses.
  const safeTitle = title ? redactSecrets(title) : title;
  const safeBody = body
    ? type === 'error'
      ? sanitizeDisplayText(body)
      : redactSecrets(body)
    : body;
  const heading = clampText(safeTitle || safeBody, ERROR_COPY_LIMITS.toastTitle);
  const detail = safeTitle ? clampText(safeBody, ERROR_COPY_LIMITS.toastBody) : undefined;
  const actionLabel = action ? clampText(action.label, ERROR_COPY_LIMITS.toastAction) : undefined;

  // A plain View unless the toast itself is tappable, so it never swallows the
  // action's or the close button's press.
  const Container = onPress ? Pressable : View;

  return (
    <Container
      role="alert"
      accessibilityLiveRegion="polite"
      onPress={onPress}
      style={[styles.toast, isDesktop ? styles.desktop : styles.mobile]}
    >
      <View style={[styles.badge, { backgroundColor: tone.badge }]}>
        <Icon size={18} color={tone.icon} strokeWidth={2} />
      </View>
      <View style={styles.text}>
        {/* Wraps rather than clips: two lines each at most, ellipsized past that. */}
        <Text numberOfLines={2} className="text-[15px] font-semibold leading-5 text-white">
          {heading}
        </Text>
        {detail ? (
          <Text numberOfLines={2} className="text-sm leading-[19px] text-white/60">
            {detail}
          </Text>
        ) : null}
      </View>
      {action && actionLabel ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => {
            hide();
            action.onPress();
          }}
          className="shrink-0 active:opacity-70 web:hover:opacity-80"
        >
          <Text numberOfLines={1} className="text-sm font-semibold leading-5 text-brand">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
      {isDesktop ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={8}
          onPress={hide}
          className="h-6 w-6 shrink-0 items-center justify-center rounded-full web:hover:bg-white/10"
        >
          <X size={16} color="rgba(255, 255, 255, 0.6)" />
        </Pressable>
      ) : null}
    </Container>
  );
};

const renderToast = (type: ToastKind) => {
  const AppToastType = ({
    text1,
    text2,
    props,
    onPress,
    hide,
  }: ToastConfigParams<AppToastProps>) => (
    <ToastView
      type={type}
      title={text1}
      body={text2}
      action={resolveAction(props)}
      onPress={onPress}
      hide={hide}
    />
  );
  AppToastType.displayName = `AppToast.${type}`;
  return AppToastType;
};

const toastConfig = {
  success: renderToast('success'),
  info: renderToast('info'),
  error: renderToast('error'),
};

/**
 * Default the display time by whether the toast has an action, for every one
 * of the app's `Toast.show` calls at once. An explicit `visibilityTime` still
 * wins. Guarded so a fast refresh doesn't wrap it twice.
 */
const patched = Toast as typeof Toast & { __solidDefaults?: boolean };
if (!patched.__solidDefaults) {
  const show = Toast.show.bind(Toast);
  Toast.show = (params: ToastShowParams) =>
    show({
      visibilityTime: hasAction(params.props) ? TOAST_WITH_ACTION_DURATION_MS : TOAST_DURATION_MS,
      ...params,
    });
  patched.__solidDefaults = true;
}

/**
 * The toast host. Mounted at the root and again inside every dialog, so a toast
 * shows above an open sheet.
 */
export const AppToast = () => {
  const insets = useSafeAreaInsets();
  const { isDesktop } = useDimension();
  return (
    <Toast
      config={toastConfig}
      position={isDesktop ? 'bottom' : 'top'}
      topOffset={insets.top + 10}
      bottomOffset={24}
      visibilityTime={TOAST_DURATION_MS}
      swipeable
    />
  );
};

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#202020',
    boxShadow: '0px 12px 16px rgba(0, 0, 0, 0.45)',
  },
  mobile: {
    alignSelf: 'stretch',
    marginHorizontal: 16,
  },
  desktop: {
    alignSelf: 'flex-end',
    width: 400,
    maxWidth: '100%',
    marginRight: 24,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
