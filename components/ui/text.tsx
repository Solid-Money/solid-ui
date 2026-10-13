import * as React from 'react';
import { Platform, StyleSheet, Text as RNText } from 'react-native';
import * as Slot from '@rn-primitives/slot';
import { cssInterop } from 'nativewind';

import { cn } from '@/lib/utils';

import type { SlottableTextProps, TextRef } from '@rn-primitives/types';

const TextClassContext = React.createContext<string | undefined>(undefined);
const TextClassOverrideContext = React.createContext<string | undefined>(undefined);

const NativeFontSizeContext = React.createContext(14);

// Resolve NativeWind classes before checking the actual font and line height.
const NativeText = React.forwardRef<TextRef, SlottableTextProps>(
  ({ style, children, ...props }, ref) => {
    const inheritedFontSize = React.useContext(NativeFontSizeContext);
    const resolvedStyle = StyleSheet.flatten(style);
    const fontSize = resolvedStyle?.fontSize ?? inheritedFontSize;
    // Keep a compact, explicit line box. Dropping lineHeight lets Mona Sans add
    // its much taller natural leading, which changes the spacing between labels.
    const minimumLineHeight = Math.ceil(fontSize * 1.2);
    const crampedLine =
      typeof resolvedStyle?.lineHeight === 'number' && resolvedStyle.lineHeight < minimumLineHeight;

    return (
      <NativeFontSizeContext.Provider value={fontSize}>
        <RNText
          {...props}
          ref={ref}
          style={crampedLine ? [style, { lineHeight: minimumLineHeight }] : style}
        >
          {children}
        </RNText>
      </NativeFontSizeContext.Provider>
    );
  },
);
NativeText.displayName = 'NativeText';
cssInterop(NativeText, { className: 'style' });

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
  ({ className, asChild = false, style, ...props }, ref) => {
    const textClass = React.useContext(TextClassContext);
    const textClassOverride = React.useContext(TextClassOverrideContext);
    const Component = asChild ? Slot.Text : Platform.OS === 'web' ? RNText : NativeText;
    const textClassName = cn(
      'text-foreground web:select-text',
      textClass,
      className,
      textClassOverride,
    );

    return (
      <Component
        className={textClassName}
        style={[
          {
            textAlignVertical: 'center',
            includeFontPadding: false,
            verticalAlign: 'middle',
          },
          style,
        ]}
        ref={ref}
        {...props}
      />
    );
  },
);
Text.displayName = 'Text';

export { Text, TextClassContext, TextClassOverrideContext };
