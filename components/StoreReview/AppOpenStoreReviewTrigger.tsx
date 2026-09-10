import { useAppOpenStoreReview } from '@/hooks/useAppOpenStoreReview';

/**
 * Headless component that records app opens and asks the user to rate the app
 * (via the native in-app store review sheet) once their card is genuinely in
 * use and they have come back to it — funded twice for a Rain cardholder, or
 * holding something the card can spend for a Wirex one. Renders nothing; mount
 * it once inside the authenticated app tree.
 */
export default function AppOpenStoreReviewTrigger() {
  useAppOpenStoreReview();
  return null;
}
