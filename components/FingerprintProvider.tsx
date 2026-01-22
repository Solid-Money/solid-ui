/**
 * Fingerprint.com Provider - Platform-specific exports.
 *
 * This file serves as the base export for TypeScript.
 * Metro/webpack will resolve to the correct platform-specific file:
 * - Native (iOS/Android): FingerprintProvider.native.tsx
 * - Web: FingerprintProvider.web.tsx
 *
 * Both providers wrap the app and enable the `useFingerprint` hook
 * to use the SDK's built-in `useVisitorData` hook.
 */
export { FingerprintProvider } from './FingerprintProvider.native';
