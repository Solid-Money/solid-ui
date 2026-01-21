import * as React from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';
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

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlayWeb = React.forwardRef<DialogPrimitive.OverlayRef, DialogPrimitive.OverlayProps>(
  ({ className, ...props }, ref) => {
    const handlePointerDown = (event: any) => {
      // Check if the clicked element is a toast
      const target = event.target as HTMLElement;
      if (target.closest('[role="alert"]')) {
        event.stopPropagation();
        return;
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
  const handlePress = (event: any) => {
    // Check if the pressed element is a toast
    const target = event.target;
    if (target?.getAttribute?.('role') === 'alert') {
      event.stopPropagation();
      return;
    }
  };

  // Check if className contains 'justify-start' to position at top
  const shouldAlignTop = className?.includes('justify-start');

  return (
    <DialogPrimitive.Overlay
      style={StyleSheet.absoluteFill}
      className={cn(
        'flex items-center bg-black/80 p-2',
        shouldAlignTop ? 'justify-start' : 'justify-center',
        className,
      )}
      onPress={handlePress}
      {...props}
      ref={ref}
    >
      <BlurView tint="dark" intensity={90} style={StyleSheet.absoluteFill} />
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
    showCloseButton?: boolean;
  }
>(
  (
    { className, children, portalHost, onCloseAutoFocus, showCloseButton = true, ...props },
    ref,
  ) => {
    const { isScreenMedium } = useDimension();
    const shouldAlignTop = className?.includes('justify-start');
    const { open } = DialogPrimitive.useRootContext();

    // Web bounce animation using useAnimatedStyle
    const opacityWeb = useSharedValue(0);
    const translateYWeb = useSharedValue(25);
    const isWebBounce = Platform.OS === 'web' && !isScreenMedium;

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
      <>
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            'mx-auto w-screen max-w-[95%] max-w-lg gap-4 rounded-2xl bg-popup p-6 web:cursor-default web:duration-200 md:rounded-twice',
            !isScreenMedium && shouldAlignTop && 'min-h-[95vh] rounded-b-none',
            className,
          )}
          onCloseAutoFocus={onCloseAutoFocus}
          {...props}
        >
          {children}
          {showCloseButton && <DialogCloseButton className="absolute right-4 top-4" />}
        </DialogPrimitive.Content>
      </>
    );

    return (
      <DialogPortal hostName={portalHost}>
        <DialogOverlay className={shouldAlignTop ? 'justify-start' : undefined}>
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
        'web:group web:focus:ring-none flex h-10 w-10 items-center justify-center rounded-full border-0 bg-popover web:ring-offset-background web:transition-colors web:hover:bg-muted web:focus:outline-none web:focus:ring-ring web:focus:ring-offset-2 web:disabled:pointer-events-none',
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
