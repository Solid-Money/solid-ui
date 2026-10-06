import { ReactNode } from 'react';
import { Redirect } from 'expo-router';

import { detectPasskeyBlock, passkeyNotSupportedHref } from '@/hooks/usePasskey';

/**
 * Renders `children` only where a passkey can be created; elsewhere, sends the
 * person to the screen that tells them to open Solid in their browser.
 *
 * For every route that needs a passkey and lives outside `(protected)`, which
 * runs the same check: onboarding (sign up or log in), the signup steps,
 * welcome and recovery. A signup link opened in Instagram's or Gmail's
 * built-in browser used to reach the passkey step and fail there, after the
 * person had already verified their email and chosen a username.
 */
export default function PasskeySupportGate({ children }: { children: ReactNode }) {
  if (detectPasskeyBlock()) return <Redirect href={passkeyNotSupportedHref()} />;
  return <>{children}</>;
}
