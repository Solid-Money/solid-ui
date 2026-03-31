/**
 * Type declarations for @meawallet/react-native-mpp when the package is not yet installed
 * (e.g. missing registry auth). Replace with package types when available.
 */
declare module '@meawallet/react-native-mpp' {
  export interface MppCardDataParametersStatic {
    withCardSecret(cardId: string, cardSecret: string): unknown;
    withEncryptedPan(
      encryptedCardData: string,
      publicKeyFingerprint: string,
      encryptedKey: string,
      initialVector: string,
    ): unknown;
  }

  export const MppCardDataParameters: MppCardDataParametersStatic;

  export interface MppInitializeOemTokenizationResponseData {
    primaryAccountIdentifier?: string;
    primaryAccountNumberSuffix?: string;
    tokenizationReceipt: string;
    cardholderName: string;
    networkName: string;
    [key: string]: unknown;
  }

  interface ApplePayApi {
    isPassLibraryAvailable(): Promise<boolean>;
    canAddPaymentPass(): Promise<boolean>;
    initializeOemTokenization(cardParams: unknown): Promise<MppInitializeOemTokenizationResponseData>;
    showAddPaymentPassView(tokenizationData: MppInitializeOemTokenizationResponseData): Promise<unknown>;
  }

  interface GooglePayApi {
    pushCard(cardParams: unknown, cardholderName: string, userAddress: string): Promise<unknown>;
    checkWalletForCardToken(cardParams: unknown): Promise<unknown>;
  }

  interface MeaPushProvisioningApi {
    initialize(configFileName?: string): Promise<void>;
    ApplePay: ApplePayApi;
    GooglePay: GooglePayApi;
  }

  const MeaPushProvisioning: MeaPushProvisioningApi;
  export default MeaPushProvisioning;

  export interface IssuerExtensionStatus {
    requiresAuthentication: boolean;
    passEntriesAvailable: boolean;
    remotePassEntriesAvailable: boolean;
  }

  export interface IssuerExtensionPaymentPassEntry {
    identifier: string;
    title: string;
    art: string; // image URL or base64
    addRequestConfiguration: unknown;
  }

  export abstract class IssuerExtensionHandler {
    abstract status(): Promise<IssuerExtensionStatus>;
    abstract passEntries(): Promise<IssuerExtensionPaymentPassEntry[]>;
    abstract remotePassEntries(): Promise<IssuerExtensionPaymentPassEntry[]>;
  }
}
