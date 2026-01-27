/**
 * Test route to preview the SignupOtp page without going through onboarding.
 * Access via: http://localhost:8081/test-otp
 *
 * TODO: Remove this file before production release
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useSignupFlowStore } from '@/store/useSignupFlowStore';

import SignupOtp from './signup/otp';

export default function TestOtp() {
  const [isReady, setIsReady] = useState(false);
  const setEmail = useSignupFlowStore(state => state.setEmail);
  const setOtpId = useSignupFlowStore(state => state.setOtpId);
  const setStep = useSignupFlowStore(state => state.setStep);
  const setHasHydrated = useSignupFlowStore(state => state.setHasHydrated);

  useEffect(() => {
    // Pre-populate the store with mock data to bypass redirect checks
    setEmail('test@example.com');
    setOtpId('mock-otp-id-12345');
    setStep('otp');
    setHasHydrated(true);
    setIsReady(true);
  }, [setEmail, setOtpId, setStep, setHasHydrated]);

  if (!isReady) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="white" />
      </View>
    );
  }

  return <SignupOtp />;
}
