import { cn } from '@/lib/utils';
import * as Slot from '@rn-primitives/slot';
import type { SlottableTextProps, TextRef } from '@rn-primitives/types';
import * as React from 'react';
import { Text as RNText } from 'react-native';

const TextClassContext = React.createContext<string | undefined>(undefined);

// see: https://github.com/expo/expo/issues/27647#issuecomment-2138495439
// type FontWeight =
//   | 'font-extralight'
//   | 'font-light'
//   | 'font-normal'
//   | 'font-medium'
//   | 'font-semibold'
//   | 'font-bold'
//   | 'font-extrabold'
//   | 'font-black';

// type PrimaryFontFamily =
//   | 'MonaSans_200ExtraLight'
//   | 'MonaSans_300Light'
//   | 'MonaSans_400Regular'
//   | 'MonaSans_500Medium'
//   | 'MonaSans_600SemiBold'
//   | 'MonaSans_700Bold'
//   | 'MonaSans_800ExtraBold'
//   | 'MonaSans_900Black';

// const fontFamilyForWeight: Record<FontWeight, PrimaryFontFamily> = {
//   'font-extralight': 'MonaSans_200ExtraLight',
//   'font-light': 'MonaSans_300Light',
//   'font-normal': 'MonaSans_400Regular',
//   'font-medium': 'MonaSans_500Medium',
//   'font-semibold': 'MonaSans_600SemiBold',
//   'font-bold': 'MonaSans_700Bold',
//   'font-extrabold': 'MonaSans_800ExtraBold',
//   'font-black': 'MonaSans_900Black',
// };

const Text = React.forwardRef<TextRef, SlottableTextProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const textClass = React.useContext(TextClassContext);
    const Component = asChild ? Slot.Text : RNText;
    const textClassName = cn('text-foreground web:select-text text-base', textClass, className);

    return (
      <Component
        className={textClassName}
        //style={{
        //  fontFamily,
        //}}
        ref={ref}
        {...props}
      />
    );
  },
);
Text.displayName = 'Text';

export { Text, TextClassContext };
