import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Pressable } from 'react-native';

const buttonVariants = cva(
  'group flex flex-row items-center justify-center gap-2 rounded-md web:transition-all duration-200 web:focus-visible:outline-none web:focus-visible:ring-none',
  {
    variants: {
      variant: {
        default: 'bg-primary web:hover:bg-primary-hover active:opacity-90 active:scale-95',
        destructive:
          'bg-destructive/60 border border-destructive shadow-md web:hover:bg-destructive-hover active:opacity-90',
        outline:
          'border border-border bg-foreground/10 web:hover:bg-foreground/5 active:bg-foreground/5',
        secondary:
          'bg-secondary border border-border web:hover:bg-secondary-hover active:opacity-80 active:scale-95',
        ghost: 'web:hover:bg-accent web:hover:text-accent-foreground active:bg-accent',
        link: 'web:underline-offset-4 web:hover:underline web:focus:underline',
        brand: 'bg-brand web:hover:bg-brand-hover active:opacity-90 active:scale-95',
        accent: 'bg-accent web:hover:bg-accent-hover active:opacity-90',
        purple: 'bg-purple/60 web:hover:bg-purple-hover active:opacity-90',
        rewards: 'bg-rewards/20 web:hover:bg-rewards/30 active:opacity-90',
      },
      size: {
        default: 'h-10 px-4 py-2 native:h-12 native:px-5 native:py-3',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8 native:h-14',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

const buttonTextVariants = cva(
  'web:whitespace-nowrap text-sm native:text-base font-medium text-foreground web:transition-colors',
  {
    variants: {
      variant: {
        default: 'text-primary-foreground',
        destructive: 'text-destructive-foreground',
        outline: 'group-active:text-accent-foreground',
        secondary: 'text-secondary-foreground group-active:text-secondary-foreground',
        ghost: 'group-active:text-accent-foreground',
        link: 'text-primary group-active:underline',
        brand: 'text-primary-foreground',
        accent: 'text-primary-foreground',
        purple: 'text-primary-foreground',
      },
      size: {
        default: '',
        sm: '',
        lg: 'native:text-lg',
        icon: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type ButtonProps = React.ComponentPropsWithoutRef<typeof Pressable> &
  VariantProps<typeof buttonVariants>;

const Button = React.forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <TextClassContext.Provider
        value={buttonTextVariants({ variant, size, className: 'web:pointer-events-none' })}
      >
        <Pressable
          className={cn(
            props.disabled && 'opacity-50 web:pointer-events-none',
            buttonVariants({ variant, size, className }),
          )}
          ref={ref}
          role="button"
          {...props}
        />
      </TextClassContext.Provider>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };

