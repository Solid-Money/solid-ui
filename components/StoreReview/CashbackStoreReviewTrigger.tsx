import { useCashbackStoreReview } from '@/hooks/useCashbackStoreReview';

/**
 * Headless component that asks the user to rate the app (via the native in-app
 * store review sheet) after they successfully receive soUSD cashback. Renders
 * nothing; mount it once inside the authenticated app tree.
 */
export default function CashbackStoreReviewTrigger() {
  useCashbackStoreReview();
  return null;
}
