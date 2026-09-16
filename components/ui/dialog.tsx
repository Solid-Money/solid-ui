import * as React from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type ViewProps } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { BlurView } from 'expo-blur';
import * as DialogPrimitive from '@rn-primitives/dialog';

import { toastProps } from '@/components/Toast';
import { useDimension } from '@/hooks/useDimension';
import { X } from '@/lib/icons/X';
import { cn } from '@/lib/utils';

/**
 * Fraction of the viewport left above a top-aligned mobile sheet. Must match the
 * `mt-[5vh]` ResponsiveModal puts on small-screen dialog content.
 */
export const MOBILE_SHEET_TOP_RATIO = 0.05;

/**
 * How long a web bottom sheet takes to slide away, and how long its tree is kept
 * alive so it can. Shared by the exit animation and the unmount that follows it.
 */
const WEB_SHEET_EXIT_MS = 180;
/**
 * Slack between the animation ending and the unmount, so a frame lost to a busy main
 * thread cannot cut the slide off at the very end — which looks exactly like the
 * abrupt close this whole mechanism exists to remove.
 */
const WEB_SHEET_UNMOUNT_BUFFER_MS = 60;

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlayWeb = React.forwardRef<DialogPrimitive.OverlayRef, DialogPrimitive.OverlayProps>(
  ({ className, closeOnPress, ...props }, ref) => {
    const { onOpenChange } = DialogPrimitive.useRootContext();

    const handlePointerDown = (event: any) => {
      // Check if the clicked element is a toast
      const target = event.target as HTMLElement;
      if (target.closest('[role="alert"]')) {
        event.stopPropagation();
        return;
      }

      // Dismiss on a backdrop press.
      //
      // `closeOnPress` is declared by the primitive as NATIVE ONLY, and the native
      // overlay honours it while the web one drops it on the floor — so a web bottom
      // sheet stayed put when you clicked beside it, even though the same component
      // dismissed on native. Radix's own outside-press dismissal does not cover this
      // case either: the sheet's content is rendered INSIDE this overlay (see the
      // `isWebBottomSheet` branch below, which needs the overlay to lay the sheet out),
      // so a click beside it is not outside the layer Radix is watching.
      //
      // `target === currentTarget` is what keeps it to the backdrop: every press from
      // within the sheet bubbles up to here too, and closing on those would make the
      // whole sheet dismiss itself on any tap.
      if (closeOnPress && target === event.currentTarget) {
        onOpenChange(false);
      }
    };

    return (
      <DialogPrimitive.Overlay
        className={cn(
          'absolute bottom-0 left-0 right-0 top-0 flex items-center justify-center bg-black/80 p-2 web:backdrop-blur-[4px]',
          className,
        )}
        onPointerDown={handlePointerDown}
        {...props}
        ref={ref}
      />
    );
  },
);

DialogOverlayWeb.displayName = 'DialogOverlayWeb';

const DialogOverlayNative = React.forwardRef<
  DialogPrimitive.OverlayRef,
  DialogPrimitive.OverlayProps
>(({ className, children, ...props }, ref) => {
  return (
    <DialogPrimitive.Overlay
      style={StyleSheet.absoluteFill}
      className={cn('flex items-center bg-black/80 p-2', className)}
      {...props}
      ref={ref}
    >
      <BlurView tint="dark" intensity={90} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {children as React.ReactNode}
    </DialogPrimitive.Overlay>
  );
});

DialogOverlayNative.displayName = 'DialogOverlayNative';

const DialogOverlay = Platform.select({
  web: DialogOverlayWeb,
  default: DialogOverlayNative,
});

const DialogContent = React.forwardRef<
  DialogPrimitive.ContentRef,
  DialogPrimitive.ContentProps & {
    portalHost?: string;
    onCloseAutoFocus?: (event: Event) => void;
    overlayClassName?: string;
    showCloseButton?: boolean;
    /**
     * Web-only presentation override. Bottom sheets are laid out by the overlay
     * instead of using `position: fixed`, which would otherwise be contained by
     * the dialog's transformed animation wrapper on small screens.
     */
    webPresentation?: 'modal' | 'bottom-sheet';
    nativePresentation?: 'modal' | 'bottom-sheet';
  }
>(
  (
    {
      className,
      children,
      portalHost,
      onCloseAutoFocus,
      overlayClassName,
      showCloseButton = true,
      webPresentation = 'modal',
      nativePresentation = 'modal',
      style,
      onMoveShouldSetResponder,
      onStartShouldSetResponder,
      ...props
    },
    ref,
  ) => {
    const { isScreenMedium } = useDimension();
    const { height: windowHeight } = useWindowDimensions();
    const shouldAlignTop = className?.includes('justify-start');
    const { open } = DialogPrimitive.useRootContext();
    const isWebBottomSheet =
      Platform.OS === 'web' && !isScreenMedium && webPresentation === 'bottom-sheet';
    // Top-aligned sheets are pushed down by `mt-[5vh]` (ResponsiveModal) and sit
    // inside an overlay with 8px padding, so a full-viewport height overflowed the
    // bottom of the screen by that much — clipping whatever the content ended with
    // (e.g. the deposit form's submit button). Subtract the offset so the sheet
    // ends exactly at the bottom edge.
    const mobileSheetHeight =
      !isScreenMedium && shouldAlignTop
        ? Math.max(windowHeight * (1 - MOBILE_SHEET_TOP_RATIO) - 8, 0)
        : undefined;

    // Web bounce animation using useAnimatedStyle
    const opacityWeb = useSharedValue(0);
    const translateYWeb = useSharedValue(25);
    const isWebBounce =
      Platform.OS === 'web' && !isScreenMedium && webPresentation !== 'bottom-sheet';

    React.useEffect(() => {
      if (isWebBounce && open) {
        // Reset values when dialog opens
        opacityWeb.value = 0;
        translateYWeb.value = 25;

        const springConfig = {
          damping: 12,
          mass: 0.8,
          stiffness: 300,
        };
        opacityWeb.value = withSpring(1, springConfig);
        translateYWeb.value = withSpring(0, springConfig);
      } else if (isWebBounce && !open) {
        // Reset when dialog closes
        opacityWeb.value = 0;
        translateYWeb.value = 25;
      }
    }, [isWebBounce, open, opacityWeb, translateYWeb]);

    React.useEffect(() => {
      if (Platform.OS === 'web' && open) {
        (document.activeElement as HTMLElement)?.blur();
      }
    }, [open]);

    /**
     * Presence for the web bottom sheet, taken over from Radix.
     *
     * Radix wraps the portal, the overlay and the content in `Presence`, and each one
     * unmounts the moment `open` goes false unless a **CSS animation** is running on its
     * own node. The primitive gives us no way to put one there — our `className` lands on
     * a child of Radix's wrapper, not on the wrapper — so the `exiting` animation below
     * never got the chance to run and the sheet simply vanished. Opening looked right
     * only because `entering` plays *after* mount, which nothing interferes with.
     *
     * So the sheet is held here instead: `forceMount` keeps Radix's tree alive, removing
     * the inner `Animated.View` is what triggers the slide out, and this drops the tree
     * once the slide has had time to finish.
     */
    const [isSheetPresent, setIsSheetPresent] = React.useState(open);

    React.useEffect(() => {
      if (!isWebBottomSheet) return;

      if (open) {
        setIsSheetPresent(true);
        return;
      }

      const timer = setTimeout(
        () => setIsSheetPresent(false),
        WEB_SHEET_EXIT_MS + WEB_SHEET_UNMOUNT_BUFFER_MS,
      );

      return () => clearTimeout(timer);
    }, [isWebBottomSheet, open]);

    const webBounceStyle = useAnimatedStyle(() => {
      if (!isWebBounce) return {};
      return {
        opacity: opacityWeb.value,
        transform: [{ translateY: translateYWeb.value }],
      };
    }, [isWebBounce]);

    const enteringAnimation = isScreenMedium
      ? FadeIn.duration(150)
      : Platform.OS === 'web'
        ? undefined // Using useAnimatedStyle for web instead
        : FadeInDown.springify().stiffness(300).damping(12).mass(0.8);

    const content = (
      <DialogPrimitive.Content
        ref={ref}
        style={[
          style,
          mobileSheetHeight
            ? {
                height: mobileSheetHeight,
                maxHeight: mobileSheetHeight,
              }
            : undefined,
        ]}
        className={cn(
          'mx-auto w-screen max-w-[min(95vw,32rem)] gap-4 rounded-2xl bg-popup p-6 web:cursor-default web:duration-200 md:rounded-twice',
          !isScreenMedium && shouldAlignTop && 'min-h-0 overflow-hidden rounded-b-none',
          className,
        )}
        onCloseAutoFocus={onCloseAutoFocus}
        onMoveShouldSetResponder={
          onMoveShouldSetResponder ?? (Platform.OS === 'web' ? undefined : () => false)
        }
        onStartShouldSetResponder={
          onStartShouldSetResponder ?? (Platform.OS === 'web' ? undefined : () => false)
        }
        {...props}
      >
        {children}
        {showCloseButton && <DialogCloseButton className="absolute right-4 top-4" />}
      </DialogPrimitive.Content>
    );

    if (Platform.OS !== 'web') {
      const isBottomSheet = nativePresentation === 'bottom-sheet' && !isScreenMedium;
      return (
        <DialogPortal hostName={portalHost}>
          <DialogOverlay
            className={cn(shouldAlignTop && 'justify-start', overlayClassName)}
            closeOnPress={isBottomSheet}
          />
          <View
            style={StyleSheet.absoluteFill}
            pointerEvents="box-none"
            className={cn(
              'flex items-center p-2',
              isBottomSheet
                ? 'justify-end p-0'
                : shouldAlignTop
                  ? 'justify-start'
                  : 'justify-center',
            )}
          >
            <Animated.View
              style={isBottomSheet ? { width: '100%' } : undefined}
              entering={enteringAnimation}
              exiting={FadeOutDown.duration(180)}
            >
              {content}
            </Animated.View>
            <Toast {...toastProps} />
          </View>
        </DialogPortal>
      );
    }

    if (isWebBottomSheet) {
      // Closed and the slide has finished. Same result as letting Radix unmount, which
      // is what happened here before presence moved into this component.
      if (!isSheetPresent) return null;

      return (
        <DialogPortal hostName={portalHost} forceMount>
          {/* Dismisses on a backdrop click, the same as the native bottom-sheet
              branch above. Tapping beside a sheet to close it is how every sheet
              on both platforms behaves, and this was the one that did not.

              The backdrop fades with a plain CSS transition rather than a Reanimated
              one: it is a DOM element we style directly, so there is nothing to work
              around, and it keeps the two halves of the exit independent — the sheet
              slides, the dimming lifts, neither waits on the other. Pointer events go
              first, so a click during the fade cannot reopen anything underneath. */}
          <DialogOverlay
            className={cn(
              'items-stretch justify-end p-0 web:transition-opacity web:duration-200',
              !open && 'web:pointer-events-none web:opacity-0',
              overlayClassName,
            )}
            closeOnPress
          >
            {/* Removed on close rather than left mounted: an exit animation is
                triggered by the node going away, and with `forceMount` above holding
                Radix's tree open this is the only thing that still does. */}
            {open ? (
              <Animated.View
                className="w-full"
                entering={FadeInDown.springify().stiffness(300).damping(12).mass(0.8)}
                exiting={FadeOutDown.duration(WEB_SHEET_EXIT_MS)}
              >
                {content}
              </Animated.View>
            ) : null}
            <Toast {...toastProps} />
          </DialogOverlay>
        </DialogPortal>
      );
    }

    return (
      <DialogPortal hostName={portalHost}>
        <DialogOverlay className={cn(shouldAlignTop && 'justify-start', overlayClassName)}>
          <Animated.View
            entering={enteringAnimation}
            exiting={isScreenMedium ? FadeOut.duration(150) : FadeOutDown.duration(180)}
            style={isWebBounce ? webBounceStyle : undefined}
          >
            {content}
          </Animated.View>
          <Toast {...toastProps} />
        </DialogOverlay>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: ViewProps) => (
  <View className={cn('flex flex-col gap-1.5 text-center sm:text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: ViewProps) => (
  <View
    className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<DialogPrimitive.TitleRef, DialogPrimitive.TitleProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        'native:text-xl text-lg font-semibold leading-none tracking-tight text-foreground',
        className,
      )}
      {...props}
    />
  ),
);
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  DialogPrimitive.DescriptionRef,
  DialogPrimitive.DescriptionProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('native:text-base text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

const DialogCloseButton = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close> & {
    className?: string;
    onPress?: () => void;
  }
>(({ className, onPress, ...props }, ref) => {
  const { open, onOpenChange } = DialogPrimitive.useRootContext();

  const handlePress = () => {
    onOpenChange?.(false);
    onPress?.();
  };

  return (
    <DialogPrimitive.Close
      ref={ref}
      className={cn(
        'web:group web:focus:ring-none flex h-[50px] w-[50px] items-center justify-center rounded-full border-0 bg-popover web:ring-offset-background web:transition-colors web:hover:bg-muted web:focus:outline-none web:focus:ring-ring web:focus:ring-offset-2 web:disabled:pointer-events-none',
        className,
      )}
      onPress={handlePress}
      {...props}
    >
      <X
        size={Platform.OS === 'web' ? 22 : 18}
        className={cn('text-muted-foreground', open && 'text-accent-foreground')}
      />
    </DialogPrimitive.Close>
  );
});
DialogCloseButton.displayName = 'DialogCloseButton';

export {
  Dialog,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
