/**
 * Prefilled into the support chat when someone has lost their authenticator
 * app. The app has no way to turn 2FA off without a code, so support resets it
 * from the admin portal once they have confirmed the request is the owner's —
 * this line tells them up front which tool the ticket needs.
 */
export const LOST_AUTHENTICATOR_SUPPORT_MESSAGE =
  "I've lost access to my authenticator app and need my two-factor authentication (2FA) reset.";
