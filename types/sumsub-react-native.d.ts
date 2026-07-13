/**
 * Minimal type declarations for @sumsub/react-native-mobilesdk-module, which
 * ships no TypeScript types. Covers the SNSMobileSDK builder surface used by the
 * native Sumsub KYC screen. Replace with package types if they are ever added.
 */
declare module '@sumsub/react-native-mobilesdk-module' {
  export interface SNSStatusChangedEvent {
    prevStatus?: string;
    newStatus?: string;
  }

  export interface SNSHandlers {
    onStatusChanged?: (event: SNSStatusChangedEvent) => void;
    onLog?: (event: { message?: string }) => void;
    onEvent?: (event: unknown) => void;
    onActionResult?: (event: unknown) => unknown;
  }

  export interface SNSLaunchResult {
    success?: boolean;
    status?: string;
    errorType?: string;
    errorMsg?: string;
  }

  export interface SNSMobileSDKInstance {
    launch(): Promise<SNSLaunchResult>;
    dismiss(): void;
  }

  export interface SNSInitBuilder {
    withHandlers(handlers: SNSHandlers): SNSInitBuilder;
    withDebug(debug: boolean): SNSInitBuilder;
    withLocale(locale: string): SNSInitBuilder;
    build(): SNSMobileSDKInstance;
  }

  export interface SNSMobileSDKStatic {
    init(
      accessToken: string,
      expirationHandler: () => Promise<string>,
    ): SNSInitBuilder;
  }

  const SNSMobileSDK: SNSMobileSDKStatic;
  export default SNSMobileSDK;
}
