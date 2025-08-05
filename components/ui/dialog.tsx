import * as DialogPrimitive from '@rn-primitives/dialog';
import * as React from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';

import { toastProps } from '@/components/Toast';
import { X } from '@/lib/icons/X';
import { cn } from '@/lib/utils';
import { BlurView } from 'expo-blur';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlayWeb = React.forwardRef<DialogPrimitive.OverlayRef, DialogPrimitive.OverlayProps>(
  ({ className, ...props }, ref) => {
    const { open } = DialogPrimitive.useRootContext();

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
          'web:backdrop-blur-[11px] flex justify-center items-center p-2 absolute top-0 right-0 bottom-0 left-0',
          open ? 'web:animate-in web:fade-in-0' : 'web:animate-out web:fade-out-0',
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

  return (
    <DialogPrimitive.Overlay
      style={StyleSheet.absoluteFill}
      className={cn('flex bg-black/80 justify-center items-center p-2', className)}
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
  DialogPrimitive.ContentProps & { portalHost?: string }
>(({ className, children, portalHost, ...props }, ref) => {
  const { open } = DialogPrimitive.useRootContext();

  const content = (
    <>
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'max-w-lg gap-4 web:cursor-default bg-card p-6 shadow-lg web:duration-200 rounded-2xl md:rounded-twice w-screen mx-auto max-w-[95%]',
          open
            ? 'web:animate-in web:fade-in-0 web:zoom-in-95'
            : 'web:animate-out web:fade-out-0 web:zoom-out-95',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className={
            'absolute top-4 md:top-0 right-4 md:-right-12 h-6 w-6 md:h-10 md:w-10 flex items-center justify-center bg-card md:border border-border rounded-full web:group web:ring-offset-background web:transition-opacity web:hover:opacity-70 web:focus:outline-none web:focus:ring-none web:focus:ring-ring web:focus:ring-offset-2 web:disabled:pointer-events-none'
          }
        >
          <X
            size={Platform.OS === 'web' ? 16 : 18}
            className={cn('text-muted-foreground', open && 'text-accent-foreground')}
          />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
      <Toast {...toastProps} />
    </>
  );

  return (
    <DialogPortal hostName={portalHost}>
      <DialogOverlay>
        {Platform.OS === 'web' ? (
          content
        ) : (
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(150)}
            style={StyleSheet.absoluteFill}
            className="flex items-center justify-center"
          >
            {content}
          </Animated.View>
        )}
      </DialogOverlay>
    </DialogPortal>
  );
});
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

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
