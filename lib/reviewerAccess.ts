import { EXPO_PUBLIC_SHARED_REVIEW_ACCESS_EMAIL } from '@/lib/config';

export const SHARED_REVIEW_ACCESS_EMAIL =
  EXPO_PUBLIC_SHARED_REVIEW_ACCESS_EMAIL.trim().toLowerCase();

export const isSharedReviewAccessEmail = (email?: string | null): boolean =>
  !!SHARED_REVIEW_ACCESS_EMAIL && email?.toLowerCase() === SHARED_REVIEW_ACCESS_EMAIL;
