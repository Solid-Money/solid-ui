import { cn } from '@/lib/utils';
import * as React from 'react';
import { TextInput, TextInputProps } from 'react-native';

export type InputProps = TextInputProps & {
  className?: string;
  error?: boolean;
};

const Input = React.forwardRef<TextInput, InputProps>(({ className, error, ...props }, ref) => {
  return (
    <TextInput
      ref={ref}
      className={cn(
        'h-14 px-6 rounded-xl border bg-[#1F1F1F] text-lg font-semibold native:text-white placeholder:text-muted-foreground',
        error ? 'border-red-500' : 'border-border',
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export default Input;
