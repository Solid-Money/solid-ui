import { cn } from '@/lib/utils';
import { forwardRef } from 'react';
import { TextInput, TextInputProps } from 'react-native';

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
        'flex-1 text-white font-semibold px-0 py-2 bg-transparent',
        isModal ? 'text-2xl w-0 min-w-0' : 'text-4xl',
        className,
      )}
      {...rest}
    />
  );
});

export default AmountInput;
