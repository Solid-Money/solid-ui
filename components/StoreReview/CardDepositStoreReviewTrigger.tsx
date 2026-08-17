import { useCardDepositStoreReview } from '@/hooks/useCardDepositStoreReview';

/**
 * Headless component that records app opens and asks the user to rate the app
 * (via the native in-app store review sheet) once they've funded their card
 * twice and come back to it. Renders nothing; mount it once inside the
 * authenticated app tree.
 */
export default function CardDepositStoreReviewTrigger() {
  useCardDepositStoreReview();
  return null;
}
