import * as AccordionPrimitive from '@rn-primitives/accordion';
import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOutUp,
  LayoutAnimationConfig,
  LinearTransition,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

import { TextClassContext } from '@/components/ui/text';
import { Minus } from '@/lib/icons/Minus';
import { Plus } from '@/lib/icons/Plus';
import { cn } from '@/lib/utils';

function Accordion({
  children,
  ...props
}: Omit<AccordionPrimitive.RootProps, 'asChild'> & {
  ref?: React.RefObject<AccordionPrimitive.RootRef>;
}) {
  const childrenArray = React.Children.toArray(children);
  const patchedChildren = childrenArray.map((child, index) => {
    if (index === 0 && React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement<any>, {
        className: cn((child as any).props?.className, 'border-t-0'),
      });
    }
    return child;
  });
  return (
    <LayoutAnimationConfig skipEntering>
      <AccordionPrimitive.Root
        {...(props as AccordionPrimitive.RootProps)}
        asChild={Platform.OS !== 'web'}
      >
        <Animated.View layout={LinearTransition.duration(200)}>{patchedChildren}</Animated.View>
      </AccordionPrimitive.Root>
    </LayoutAnimationConfig>
  );
}

function AccordionItem({
  className,
  value,
  ...props
}: AccordionPrimitive.ItemProps & {
  ref?: React.RefObject<AccordionPrimitive.ItemRef>;
}) {
  return (
    <Animated.View className={'overflow-hidden'} layout={LinearTransition.duration(200)}>
      <AccordionPrimitive.Item
        className={cn('border-t border-border/50', className)}
        value={value}
        {...props}
      />
    </Animated.View>
  );
}

const Trigger = Platform.OS === 'web' ? View : Pressable;

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.TriggerProps & {
  children?: React.ReactNode;
  ref?: React.RefObject<AccordionPrimitive.TriggerRef>;
}) {
  const { isExpanded } = AccordionPrimitive.useItemContext();

  const progress = useDerivedValue(() =>
    isExpanded ? withTiming(1, { duration: 250 }) : withTiming(0, { duration: 200 }),
  );
  const plusStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 90}deg` }],
  }));
  const minusStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(1 - progress.value) * 90}deg` }],
  }));

  return (
    <TextClassContext.Provider value="native:text-lg font-medium web:group-hover:opacity-80">
      <AccordionPrimitive.Header className="flex">
        <AccordionPrimitive.Trigger {...props} asChild>
          <Trigger
            className={cn(
              'group flex flex-row items-center gap-6 p-4 web:flex-1 web:transition-all web:focus-visible:outline-none web:focus-visible:ring-1 web:focus-visible:ring-muted-foreground',
              className,
            )}
          >
            {isExpanded ? (
              <Animated.View style={minusStyle}>
                <Minus size={18} className={'shrink-0 text-foreground'} />
              </Animated.View>
            ) : (
              <Animated.View style={plusStyle}>
                <Plus size={18} className={'shrink-0 text-foreground'} />
              </Animated.View>
            )}
            {children}
          </Trigger>
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
    </TextClassContext.Provider>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.ContentProps & {
  ref?: React.RefObject<AccordionPrimitive.ContentRef>;
}) {
  const { isExpanded } = AccordionPrimitive.useItemContext();
  return (
    <TextClassContext.Provider value="native:text-lg">
      <AccordionPrimitive.Content
        className={cn(
          'overflow-hidden text-sm web:transition-all',
          isExpanded ? 'web:animate-accordion-down' : 'web:animate-accordion-up',
        )}
        {...props}
      >
        <InnerContent className={cn('px-4 pb-4 md:pl-14', className)}>{children}</InnerContent>
      </AccordionPrimitive.Content>
    </TextClassContext.Provider>
  );
}

function InnerContent({ children, className }: { children: React.ReactNode; className?: string }) {
  if (Platform.OS === 'web') {
    return <View className={cn('pb-4', className)}>{children}</View>;
  }
  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOutUp.duration(200)}
      className={cn('pb-4', className)}
    >
      {children}
    </Animated.View>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
