import { CardStatusPage } from '@/components/Card/CardStatusPage';

/**
 * "Your card is on its way" — what the issuance flow shows once an applicant's
 * identity verification has been submitted and is waiting on a decision
 * (Figma 16412:2842).
 *
 * It replaces the whole activation screen rather than sitting inside it. While a
 * decision is being made there is no step for the user to take, and the steps
 * list led with "Complete KYC" behind a disabled button — which reads as "verify
 * again" to someone who has just finished verifying.
 *
 * Nothing is styled here: `CardStatusPage`'s own defaults are the drawn design —
 * the "Solid card" header, the faded card artwork, and the same panel every
 * other card status screen uses. The copy is left to wrap rather than carrying
 * the design's hard line breaks, which would fall in the wrong places on a
 * phone.
 *
 * The drawn copy's typos are fixed here, as they are on the home banner: "on
 * it's way", and "by mail" for what is the email the KYC webhooks send.
 */
export function UnderReviewState() {
  return (
    <CardStatusPage
      title="Your card is on its way!"
      description="Thanks for your submission. Your identity is now being verified. You will be notified by email once you get approved"
    />
  );
}
