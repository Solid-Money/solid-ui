import { forwardRef } from 'react';
import { TextInput, TextInputProps } from 'react-native';

import { cn } from '@/lib/utils';

type AmountInputProps = TextInputProps & {
  className?: string;
  isModal?: boolean;
};

const AmountInput = forwardRef<TextInput, AmountInputProps>(function AmountInput(
  { className, keyboardType = 'decimal-pad', isModal = false, ...rest },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      keyboardType={keyboardType}
      placeholderTextColor={'#9CA3AF'}
      className={cn(
        'flex-1 bg-transparent px-0 py-2 font-semibold text-white',
        isModal ? 'w-0 min-w-0 text-3xl' : 'text-4xl',
        className,
      )}
      {...rest}
    />
  );
});

export default AmountInput;
