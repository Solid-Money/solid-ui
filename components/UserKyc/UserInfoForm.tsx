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
    <View className="space-y-6 mb-8">
      <View>
        <Text className="text-lg font-medium text-[#ACACAC] mb-2">Full name</Text>
        <Controller
          control={control}
          name="fullName"
          render={({ field: { onChange, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              className="h-14 px-6 rounded-xl text-lg text-foreground font-semibold bg-[#333331]"
              autoCapitalize="words"
            />
          )}
        />
        {errors.fullName && (
          <Text className="text-red-500 text-sm mt-1">{errors.fullName.message}</Text>
        )}
      </View>

      <View>
        <Text className="text-lg font-medium text-[#ACACAC] mb-2 mt-6">Email Address</Text>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              keyboardType="email-address"
              className="h-14 px-6 rounded-xl text-lg text-foreground font-semibold bg-[#333331]"
              autoCapitalize="none"
              autoComplete="email"
            />
          )}
        />
        {errors.email && <Text className="text-red-500 text-sm mt-1">{errors.email.message}</Text>}
      </View>
    </View>
  );
}
