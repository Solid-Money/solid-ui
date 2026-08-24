// Web entry. `index.native.tsx` is the native counterpart — Metro resolves that
// on iOS/Android and this file on web.
//
// Both entries are needed: a barrel's *contents* are not platform-resolved, only
// the specifier being imported is, and consumers import this directory. With no
// `index.native` sibling this file served every platform, which shipped the web
// variant to native and left `DepositTokenSelector.native.tsx` dead.
export { default } from './DepositTokenSelector.web';
