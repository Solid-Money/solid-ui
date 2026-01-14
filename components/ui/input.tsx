import * as React from 'react';
import { TextInput, TextInputProps } from 'react-native';

import { cn } from '@/lib/utils';

export type InputProps = TextInputProps & {
  className?: string;
  error?: boolean;
};

const Input = React.forwardRef<TextInput, InputProps>(({ className, error, ...props }, ref) => {
  return (
    <TextInput
      ref={ref}
      className={cn(
        'native:text-white h-14 rounded-xl border border-transparent bg-[#1F1F1F] px-6 text-lg font-semibold placeholder:text-muted-foreground focus:border-border',
        {
          'border-red-500': error,
        },
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export default Input;
