/**
 * Stub for @meawallet/react-native-mpp. Use when the real package is not available (e.g. no registry auth).
 * Replace dependency in root package.json with real "@meawallet/react-native-mpp" when ready.
 */

const noop = () => Promise.resolve();
const noopSync = () => {};

const MppCardDataParameters = {
  withCardSecret(_cardId, _cardSecret) {
    return {};
  },
  withEncryptedPan(_encryptedCardData, _publicKeyFingerprint, _encryptedKey, _initialVector) {
    return {};
  },
};

const ApplePay = {
  isPassLibraryAvailable: () => Promise.resolve(false),
  canAddPaymentPass: () => Promise.resolve(false),
  initializeOemTokenization: () => Promise.resolve({ tokenizationReceipt: '', cardholderName: '', primaryAccountNumberSuffix: '', primaryAccountIdentifier: '', networkName: '' }),
  showAddPaymentPassView: noop,
  secureElementPassExistsWithPrimaryAccountNumberSuffix: () => Promise.resolve(false),
  remoteSecureElementPassExistsWithPrimaryAccountNumberSuffix: () => Promise.resolve(false),
  IssuerUIExtension: {
    completeAuthentication: noopSync,
  },
};

const GooglePay = {
  pushCard: noop,
  checkWalletForCardToken: () => Promise.resolve(null),
};

const defaultExport = {
  __stub: true, // Set when real package is used: delete this; app treats __stub as "MPP not available"
  initialize: noop,
  ApplePay,
  GooglePay,
};

// Abstract class stub for IssuerExtensionHandler (extensions won't work with stub)
class IssuerExtensionHandler {
  async status() {
    return { requiresAuthentication: true, passEntriesAvailable: false, remotePassEntriesAvailable: false };
  }
  async passEntries() {
    return [];
  }
  async remotePassEntries() {
    return [];
  }
}

module.exports = defaultExport;
module.exports.default = defaultExport;
module.exports.MppCardDataParameters = MppCardDataParameters;
module.exports.IssuerExtensionHandler = IssuerExtensionHandler;
