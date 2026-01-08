import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';

export type SignupStep = 'email' | 'otp' | 'passkey' | 'creating' | 'complete';

interface SignupFlowState {
  // Current step in the signup flow
  step: SignupStep;

  // User input data
  email: string;
  marketingConsent: boolean;
  referralCode: string;

  // OTP verification data
  otpId: string;
  verificationToken: string;

  // Passkey data (from WebAuthn creation before account creation)
  challenge: string;
  attestation: any;
  credentialId: string;

  // Error handling
  error: string | null;
  isLoading: boolean;

  // Rate limiting
  rateLimitError: string | null;
  lastOtpSentAt: number | null;

  // Hydration tracking to prevent race conditions
  _hasHydrated: boolean;
}

interface SignupFlowActions {
  // Step navigation
  setStep: (step: SignupStep) => void;
  goBack: () => void;

  // Data setters
  setEmail: (email: string) => void;
  setMarketingConsent: (consent: boolean) => void;
  setReferralCode: (code: string) => void;
  setOtpId: (otpId: string) => void;
  setVerificationToken: (token: string) => void;
  setPasskeyData: (data: { challenge: string; attestation: any; credentialId: string }) => void;

  // Error handling
  setError: (error: string | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setRateLimitError: (error: string | null) => void;
  setLastOtpSentAt: (timestamp: number | null) => void;

  // Hydration tracking
  setHasHydrated: (state: boolean) => void;

  // Reset the entire flow
  reset: () => void;
}

const initialState: SignupFlowState = {
  step: 'email',
  email: '',
  marketingConsent: false,
  referralCode: '',
  otpId: '',
  verificationToken: '',
  challenge: '',
  attestation: null,
  credentialId: '',
  error: null,
  isLoading: false,
  rateLimitError: null,
  lastOtpSentAt: null,
  _hasHydrated: false,
};

export const useSignupFlowStore = create<SignupFlowState & SignupFlowActions>()(
  persist(
    set => ({
      ...initialState,

      setHasHydrated: (state: boolean) => set({ _hasHydrated: state }),

      setStep: step => set({ step, error: null }),

      goBack: () =>
        set(state => {
          const stepOrder: SignupStep[] = ['email', 'otp', 'passkey', 'creating', 'complete'];
          const currentIndex = stepOrder.indexOf(state.step);
          if (currentIndex > 0) {
            return { step: stepOrder[currentIndex - 1], error: null };
          }
          return state;
        }),

      setEmail: email => set({ email }),
      setMarketingConsent: marketingConsent => set({ marketingConsent }),
      setReferralCode: referralCode => set({ referralCode }),
      setOtpId: otpId => set({ otpId }),
      setVerificationToken: verificationToken => set({ verificationToken }),
      setPasskeyData: ({ challenge, attestation, credentialId }) =>
        set({ challenge, attestation, credentialId }),

      setError: error => set({ error }),
      setIsLoading: isLoading => set({ isLoading }),
      setRateLimitError: rateLimitError => set({ rateLimitError }),
      setLastOtpSentAt: lastOtpSentAt => set({ lastOtpSentAt }),

      reset: () =>
        set(state => ({
          ...initialState,
          _hasHydrated: true,
          // Preserve referralCode captured at root level (attribution hook)
          // This prevents accidental loss during flow resets
          referralCode: state.referralCode || initialState.referralCode,
        })),
    }),
    {
      name: `${USER.storageKey}_signup_flow`,
      storage: createJSONStorage(() => mmkvStorage(`${USER.storageKey}_signup_flow`)),
      // Only persist certain fields to allow resuming if app closes during signup
      partialize: state => ({
        email: state.email,
        marketingConsent: state.marketingConsent,
        referralCode: state.referralCode,
        otpId: state.otpId,
        step: state.step,
        lastOtpSentAt: state.lastOtpSentAt,
      }),
      onRehydrateStorage: () => state => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
