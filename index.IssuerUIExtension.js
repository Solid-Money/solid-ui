/**
 * Wallet Extension entry: Issuer UI Extension (iOS).
 * Used when building the IssuerUIExtension target in Xcode.
 * Bundle with: ENTRY_FILE=index.IssuerUIExtension.js
 */
import { AppRegistry } from 'react-native';
import IssuerUIExtension from './app/extensions/App.IssuerUIExtension';

AppRegistry.registerComponent('IssuerUIExtension', () => IssuerUIExtension);
