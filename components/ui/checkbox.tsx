import { cn } from '@/lib/utils';
import { Check } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

export interface CheckboxProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

const Checkbox = React.forwardRef<View, CheckboxProps>(
  ({ checked = false, onCheckedChange, disabled = false, className }, ref) => {
    return (
      <Pressable
        ref={ref}
        onPress={() => !disabled && onCheckedChange?.(!checked)}
        disabled={disabled}
        className={cn(
          'h-[25px] w-[25px] items-center justify-center rounded-[8px] border-transparent',
          {
            'border-primary bg-primary': checked,
            'bg-[#2F2F2F]': !checked,
            'border-transparent': disabled,
          },
          className,
        )}
      >
        {checked && <Check size={14} color="#000" strokeWidth={3} />}
      </Pressable>
    );
  },
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
