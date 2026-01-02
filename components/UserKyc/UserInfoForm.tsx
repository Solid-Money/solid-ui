import React from 'react';
import { Controller } from 'react-hook-form';
import { TextInput, View } from 'react-native';

import { Text } from '@/components/ui/text';

interface UserInfoFormProps {
  control: any;
  errors: any;
}

export function UserInfoForm({ control, errors }: UserInfoFormProps) {
  return (
    <View className="mb-8 space-y-6">
      <View>
        <Text className="mb-2 text-lg font-medium text-[#ACACAC]">Full name</Text>
        <Controller
          control={control}
          name="fullName"
          render={({ field: { onChange, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              className="h-14 rounded-xl bg-[#333331] px-6 text-lg font-semibold text-foreground"
              autoCapitalize="words"
            />
          )}
        />
        {errors.fullName && (
          <Text className="mt-1 text-sm text-red-500">{errors.fullName.message}</Text>
        )}
      </View>

      <View>
        <Text className="mb-2 mt-6 text-lg font-medium text-[#ACACAC]">Email Address</Text>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              keyboardType="email-address"
              className="h-14 rounded-xl bg-[#333331] px-6 text-lg font-semibold text-foreground"
              autoCapitalize="none"
              autoComplete="email"
            />
          )}
        />
        {errors.email && <Text className="mt-1 text-sm text-red-500">{errors.email.message}</Text>}
      </View>
    </View>
  );
}
