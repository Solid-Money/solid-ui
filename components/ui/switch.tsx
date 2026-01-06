import { cn } from '@/lib/utils/index';
import * as SwitchPrimitives from '@rn-primitives/switch';
import { Check, X } from 'lucide-react-native';
import { Platform, View } from 'react-native';

function Switch({
  className,
  ...props
}: SwitchPrimitives.RootProps & React.RefAttributes<SwitchPrimitives.RootRef>) {
  return (
    <SwitchPrimitives.Root
      className={cn(
        'relative flex h-6 w-11 shrink-0 flex-row items-center rounded-full border border-transparent px-0.5 shadow-sm shadow-black/5',
        Platform.select({
          web: 'peer inline-flex outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed',
        }),
        props.checked ? 'bg-brand' : 'bg-foreground/50',
        props.disabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      <View className="absolute inset-0 flex-row items-center justify-between px-1.5">
        <Check
          size={12}
          className={cn(
            'text-card transition-opacity',
            props.checked ? 'opacity-100' : 'opacity-0',
          )}
        />
        <X
          size={12}
          className={cn(
            'text-card transition-opacity',
            props.checked ? 'opacity-0' : 'opacity-100',
          )}
        />
      </View>
      <SwitchPrimitives.Thumb
        className={cn(
          'z-10 size-5 rounded-full bg-background transition-transform',
          Platform.select({
            web: 'pointer-events-none block ring-0',
          }),
          props.checked
            ? 'translate-x-5 dark:bg-primary-foreground'
            : 'translate-x-0 dark:bg-foreground',
        )}
      />
    </SwitchPrimitives.Root>
  );
}

export { Switch };
