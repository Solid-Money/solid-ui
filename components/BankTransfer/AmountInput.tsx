import { cn } from '@/lib/utils';
import { forwardRef } from 'react';
import { TextInput, TextInputProps } from 'react-native';

type AmountInputProps = TextInputProps & {
  className?: string;
};

const AmountInput = forwardRef<TextInput, AmountInputProps>(function AmountInput(
  { className, keyboardType = 'decimal-pad', ...rest },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      keyboardType={keyboardType}
      placeholderTextColor={'#9CA3AF'}
      className={cn(
        'flex-1 text-white text-4xl font-semibold px-0 py-2',
        'bg-transparent',
        className,
      )}
      {...rest}
    />
  );
});

export default AmountInput;
