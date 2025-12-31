import React from 'react';

import { Text } from '@/components/ui/text';

import { KycMode } from './types';

interface UserInfoHeaderProps {
  kycMode?: KycMode;
}

export function UserInfoHeader({ kycMode }: UserInfoHeaderProps) {
  const text =
    kycMode === KycMode.BANK_TRANSFER
      ? 'We need some basic information to get started with your bank transfer'
      : kycMode === KycMode.CARD
        ? 'We need some basic information to get started with your card activation'
        : 'We need some basic information to get started';

  return <Text className="text-center text-lg text-[#ACACAC]">{text}</Text>;
}
