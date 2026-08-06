import * as React from 'react';
import { Platform, TextInput, TextInputProps, TextStyle } from 'react-native';

import { cn } from '@/lib/utils';

export type InputProps = TextInputProps & {
  className?: string;
  error?: boolean;
};

// Native text inputs keep the default font padding and align text to the top of
// the box, so the value sits off-centre in a fixed-height field. Browsers centre
// single-line inputs on their own, so this is native only.
const nativeTextCentering: TextStyle | undefined =
  Platform.OS === 'web'
    ? undefined
    : {
        textAlignVertical: 'center',
        verticalAlign: 'middle',
        includeFontPadding: false,
        paddingTop: 0,
        paddingBottom: 0,
      };

const Input = React.forwardRef<TextInput, InputProps>(
  ({ className, error, style, multiline, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        multiline={multiline}
        className={cn(
          'native:text-white h-14 rounded-xl border border-transparent bg-[#1F1F1F] px-6 text-lg font-semibold placeholder:text-muted-foreground focus:border-border',
          {
            'border-red-500': error,
          },
          className,
        )}
        style={[multiline ? undefined : nativeTextCentering, style]}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';

export default Input;
