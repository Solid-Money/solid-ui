import * as DialogPrimitive from '@rn-primitives/dialog';
import * as React from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';

import { toastProps } from '@/components/Toast';
import { useDimension } from '@/hooks/useDimension';
import { X } from '@/lib/icons/X';
import { cn } from '@/lib/utils';
import { BlurView } from 'expo-blur';

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
          'web:backdrop-blur-[4px] bg-black/40 flex justify-center items-center p-2 absolute top-0 right-0 bottom-0 left-0',
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
        'flex bg-black/80 items-center p-2',
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

    const content = (
      <>
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            'max-w-lg gap-4 web:cursor-default bg-popup p-6 web:duration-200 rounded-2xl md:rounded-twice w-screen mx-auto max-w-[95%]',
            className,
          )}
          onCloseAutoFocus={onCloseAutoFocus}
          {...props}
        >
          {children}
          {showCloseButton && <DialogCloseButton className="absolute top-4 right-4" />}
        </DialogPrimitive.Content>
        <Toast {...toastProps} />
      </>
    );

    return (
      <DialogPortal hostName={portalHost}>
        <DialogOverlay className={shouldAlignTop ? 'justify-start' : undefined}>
          <Animated.View
            entering={isScreenMedium ? FadeIn.duration(150) : FadeInDown.duration(150).springify()}
            exiting={isScreenMedium ? FadeOut.duration(150) : FadeOutDown.duration(180)}
          >
            {content}
          </Animated.View>
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
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end gap-2', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<DialogPrimitive.TitleRef, DialogPrimitive.TitleProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        'text-lg native:text-xl text-foreground font-semibold leading-none tracking-tight',
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
    className={cn('text-sm native:text-base text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

const DialogCloseButton = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close> & {
    className?: string;
  }
>(({ className, ...props }, ref) => {
  const { open } = DialogPrimitive.useRootContext();
  return (
    <DialogPrimitive.Close
      ref={ref}
      className={cn(
        'h-10 w-10 flex items-center justify-center bg-popover border-0 rounded-full web:group web:ring-offset-background web:transition-colors web:hover:bg-muted web:focus:outline-none web:focus:ring-none web:focus:ring-ring web:focus:ring-offset-2 web:disabled:pointer-events-none',
        className,
      )}
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
