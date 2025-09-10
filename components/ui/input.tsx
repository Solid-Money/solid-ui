import { cn } from '@/lib/utils';
import * as React from 'react';
import { TextInput, TextInputProps } from 'react-native';

export type InputProps = TextInputProps & {
  className?: string;
  error?: boolean;
};

export const Input = React.forwardRef<TextInput, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        className={cn(
          'h-14 px-6 rounded-xl border bg-[#111111] text-lg text-foreground font-semibold placeholder:text-muted-foreground',
          error ? 'border-red-500' : 'border-border',
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';

export default Input;


