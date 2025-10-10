import { useReferralStore } from '@/store/useReferralStore';

/**
 * Referral code utilities using Zustand store with MMKV for cross-platform persistence
 */

/**
 * Detects referral code from URL and saves it to storage if found
 * This should be called when the app/page loads
 */
export const detectAndSaveReferralCode = (): string | null => {
  return useReferralStore.getState().detectAndSaveReferralCode();
};

/**
 * Gets referral code for signup - checks URL first, then storage
 * @returns string | null - The referral code to use for signup
 */
export const getReferralCodeForSignup = (): string | null => {
  return useReferralStore.getState().getReferralCodeForSignup();
};

/**
 * Saves referral code to persistent storage
 * @param referralCode - The referral code to save
 */
export const saveReferralCode = (referralCode: string): void => {
  useReferralStore.getState().setReferralCode(referralCode);
};

/**
 * Clears referral code from persistent storage
 */
export const clearReferralCode = (): void => {
  useReferralStore.getState().clearReferralCode();
};

/**
 * Retrieves referral code from persistent storage
 * @returns string | null - The stored referral code or null
 */
export const getReferralCode = (): string | null => {
  return useReferralStore.getState().referralCode;
};
