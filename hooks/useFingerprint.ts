/**
 * Hook for Fingerprint.com device intelligence.
 *
 * This file serves as the TypeScript entry point for module resolution.
 * At runtime, Metro bundler will resolve to the platform-specific implementation:
 * - useFingerprint.native.ts for iOS/Android
 * - useFingerprint.web.ts for Web
 *
 * @see useFingerprint.native.ts - Native implementation using @fingerprintjs/fingerprintjs-pro-react-native
 * @see useFingerprint.web.ts - Web implementation using @fingerprintjs/fingerprintjs-pro-react
 */
export { useFingerprint } from './useFingerprint.native';
