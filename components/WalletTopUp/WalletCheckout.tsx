// Platform default (bundler/TS): the web frame. Metro resolves
// WalletCheckout.native.tsx on iOS and Android, so Wirex's web package never
// reaches the app bundle and its native SDK never reaches the web.
export { default, WalletCheckout } from './WalletCheckout.web';
