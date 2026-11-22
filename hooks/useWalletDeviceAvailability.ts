// Platform default (bundler/TS): the web probe. Metro resolves
// useWalletDeviceAvailability.native.ts on iOS and Android, so Wirex's web
// package never reaches the app bundle and its native SDK never reaches the web.
export { useWalletDeviceAvailability } from './useWalletDeviceAvailability.web';
