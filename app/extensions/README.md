# Wallet Extensions (iOS)

Issuer UI and Non-UI Extensions for Apple Wallet “add card from Wallet” flow.

## Native setup (after prebuild)

1. In Xcode, add two **Intents Extension** targets: `IssuerNonUIExtension`, `IssuerUIExtension`.
2. Bundle IDs: `app.solid.xyz.IssuerNonUIExtension`, `app.solid.xyz.IssuerUIExtension`.
3. Add PassKit and MeaPushProvisioning.xcframework to both; add `mea_config` to both targets’ resources.
4. Info.plist: set `NSExtensionPointIdentifier` and `NSExtensionPrincipalClass` per [MeaWallet Wallet Extensions Guide](https://developer.meawallet.com/mpp/react-native/wallet-extensions-guide).
5. Podfile: add nested targets for both extensions; run `pod install`.
6. Add “Bundle React Native code and images” Run Script to both extensions with `ENTRY_FILE=index.IssuerNonUIExtension.js` and `index.IssuerUIExtension.js`.
7. Enable App Group (e.g. `group.app.solid.xyz`) for main app and both extensions.

## App Group

Main app must write session/token to App Group after login so extensions can call the backend (e.g. `GET .../extension-cards`). Use `react-native-default-preference` with `GroupPreference.setName('group.app.solid.xyz')` and `GroupPreference.set('session', JSON.stringify({ token: jwt }))`.
