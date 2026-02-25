/**
 * Wallet Extension entry: Issuer Non-UI Extension (iOS).
 * Used when building the IssuerNonUIExtension target in Xcode.
 * Bundle with: ENTRY_FILE=index.IssuerNonUIExtension.js
 */
import { AppRegistry } from 'react-native';
import IssuerNonUIExtension from './app/extensions/App.IssuerNonUIExtension';

AppRegistry.registerComponent('IssuerNonUIExtension', () => IssuerNonUIExtension);
