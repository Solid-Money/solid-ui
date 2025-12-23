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
          'h-5 w-5 rounded border-transparent items-center justify-center',
          {
            'bg-primary border-primary': checked,
            'bg-[#1F1F1F] border-[#3A3A3A]': !checked,
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
