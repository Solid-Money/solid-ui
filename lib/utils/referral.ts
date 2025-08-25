import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const REFERRAL_CODE_KEY = 'solid_referral_code';

/**
 * Referral code utilities for handling URL detection and local storage persistence
 */

/**
 * Extracts referral code from URL parameters (web only)
 * @param urlSearchParams - URLSearchParams object from window.location.search
 * @returns referral code string or null
 */
export const extractReferralCodeFromUrl = (urlSearchParams?: URLSearchParams): string | null => {
  if (Platform.OS !== 'web' || !urlSearchParams) return null;

  const code = urlSearchParams.get('referralCode');

  if (code && code.trim()) return code.trim();

  return null;
};

/**
 * Saves referral code to persistent storage
 * @param referralCode - The referral code to save
 */
export const saveReferralCode = async (referralCode: string): Promise<void> => {
  if (!referralCode || !referralCode.trim()) return;

  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(REFERRAL_CODE_KEY, referralCode.trim());
    } else {
      await AsyncStorage.setItem(REFERRAL_CODE_KEY, referralCode.trim());
    }
  } catch (error) {
    console.warn('Failed to save referral code:', error);
  }
};

/**
 * Retrieves referral code from persistent storage
 * @returns Promise<string | null> - The stored referral code or null
 */
export const getReferralCode = async (): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      const code = localStorage.getItem(REFERRAL_CODE_KEY);
      return code && code.trim() ? code.trim() : null;
    } else {
      const code = await AsyncStorage.getItem(REFERRAL_CODE_KEY);
      return code && code.trim() ? code.trim() : null;
    }
  } catch (error) {
    console.warn('Failed to retrieve referral code:', error);
    return null;
  }
};

/**
 * Clears referral code from persistent storage
 */
export const clearReferralCode = async (): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(REFERRAL_CODE_KEY);
    } else {
      await AsyncStorage.removeItem(REFERRAL_CODE_KEY);
    }
  } catch (error) {
    console.warn('Failed to clear referral code:', error);
  }
};

/**
 * Detects referral code from URL and saves it to storage if found
 * This should be called when the app/page loads
 */
export const detectAndSaveReferralCode = async (): Promise<string | null> => {
  if (Platform.OS !== 'web') return null;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = extractReferralCodeFromUrl(urlParams);

    if (referralCode) {
      await saveReferralCode(referralCode);
      console.warn('Referral code detected and saved:', referralCode);
      return referralCode;
    }
  } catch (error) {
    console.warn('Failed to detect and save referral code:', error);
  }

  return null;
};

/**
 * Gets referral code for signup - checks URL first, then storage
 * @returns Promise<string | null> - The referral code to use for signup
 */
export const getReferralCodeForSignup = async (): Promise<string | null> => {
  // First try to get from URL (in case user just clicked a referral link)
  if (Platform.OS === 'web') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlReferralCode = extractReferralCodeFromUrl(urlParams);
      if (urlReferralCode) {
        // Save it to storage for future use
        await saveReferralCode(urlReferralCode);
        return urlReferralCode;
      }
    } catch (error) {
      console.warn('Failed to extract referral code from URL:', error);
    }
  }

  // If not in URL, try to get from storage
  return await getReferralCode();
};
