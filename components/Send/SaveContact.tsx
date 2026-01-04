import { useState } from 'react';
import { Controller, FieldErrors, UseFormReturn } from 'react-hook-form';
import { Pressable, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import type { AddressBookFormData } from '@/hooks/useAddressBook';

type SaveContactProps = {
  control: UseFormReturn<AddressBookFormData>['control'];
  errors: FieldErrors<AddressBookFormData>;
  showSkip2fa: boolean;
  name?: string;
};

const SaveContact: React.FC<SaveContactProps> = ({ control, errors, showSkip2fa, name }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const contentHeight = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  const derivedHeight = useDerivedValue(() => {
    return isExpanded ? contentHeight.value : 0;
  });

  const contentStyle = useAnimatedStyle(() => ({
    height: withTiming(derivedHeight.value, { duration: 200 }),
    opacity: contentOpacity.value,
  }));

  const toggleExpanded = (checked: boolean) => {
    setIsExpanded(checked);
    contentOpacity.value = withTiming(checked ? 1 : 0, { duration: 150 });
  };

  return (
    <View className="rounded-2xl bg-card p-5">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-medium">Save to contacts</Text>
        <Switch checked={isExpanded} onCheckedChange={toggleExpanded} />
      </View>

      <Animated.View style={contentStyle} className="overflow-hidden">
        <View
          className="gap-4 pt-4"
          onLayout={e => {
            contentHeight.value = e.nativeEvent.layout.height;
          }}
        >
          {!name && (
            <View className="gap-2">
              <Text className="text-base font-medium opacity-70">Name</Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    className="flex-1 rounded-2xl bg-foreground/10 p-5 text-base text-white web:focus:outline-none"
                    placeholder="Enter a name for this address"
                    placeholderTextColor="#ffffff80"
                    value={value}
                    onChangeText={onChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                )}
              />
            </View>
          )}
          {errors.name && <Text className="text-sm text-red-500">{errors.name.message}</Text>}
          {showSkip2fa && (
            <Controller
              control={control}
              name="skip2fa"
              render={({ field: { onChange, value } }) => (
                <Pressable onPress={() => onChange(!value)} className="flex-row items-center gap-3">
                  <Checkbox checked={value || false} onCheckedChange={onChange} />
                  <Text className="flex-1 text-base opacity-70">
                    Skip 2FA when sending to this address
                  </Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </Animated.View>
    </View>
  );
};

export default SaveContact;
