import * as React from 'react';
import { Platform, TextInput, TextInputProps, TextStyle, View } from 'react-native';

import { cn } from '@/lib/utils';

export type InputProps = TextInputProps & {
  className?: string;
  error?: boolean;
  /**
   * Fixed content shown inside the field, ahead of the value — the "@" on a
   * username, for instance. When set, the field's box (height, background,
   * border, padding) moves to a wrapper and the text input fills the rest of
   * the row, so `className` should carry box styles rather than text styles.
   */
  prefix?: React.ReactNode;
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

const FIELD_BOX = 'h-14 rounded-xl border border-transparent bg-[#1F1F1F] px-6 focus:border-border';
const FIELD_TEXT = 'native:text-white text-lg font-semibold placeholder:text-muted-foreground';

const Input = React.forwardRef<TextInput, InputProps>(
  ({ className, error, style, multiline, prefix, ...props }, ref) => {
    const input = (
      <TextInput
        ref={ref}
        multiline={multiline}
        className={cn(
          FIELD_TEXT,
          prefix
            ? // The wrapper owns the box; the input just fills what is left of
              // the row.
              'h-full flex-1 border-0 bg-transparent p-0'
            : cn(FIELD_BOX, { 'border-red-500': error }, className),
        )}
        style={[multiline ? undefined : nativeTextCentering, style]}
        {...props}
      />
    );

    if (!prefix) {
      return input;
    }

    return (
      <View
        className={cn(
          FIELD_BOX,
          'flex-row items-center gap-2',
          { 'border-red-500': error },
          className,
        )}
      >
        {prefix}
        {input}
      </View>
    );
  },
);

Input.displayName = 'Input';

export default Input;
