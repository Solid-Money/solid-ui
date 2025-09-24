import * as Sentry from '@sentry/react-native';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { createAppleWalletProvision } from '@/lib/api';
import {
  AppleWalletCardStatus,
  AppleWalletConfig,
  AppleWalletProvisionResult,
} from '@/lib/types/apple-wallet';
import {
  addCardToAppleWallet,
  AddToWalletButton,
  getCardStatusBySuffix,
} from '@expensify/react-native-wallet';
import { Platform } from 'react-native';

/**
 * Callback function that exchanges Apple's nonce/certificates for Bridge's encrypted payload
 */
async function issuerEncryptPayloadCallback(
  nonce: string,
  nonceSignature: string,
  certificates: string[],
): Promise<{
  encryptedPassData: string;
  activationData: string;
  ephemeralPublicKey: string;
}> {
  try {
    const [leafCert, subordinateCert] = certificates;

    Sentry.addBreadcrumb({
      message: 'Apple Wallet payload encryption started',
      category: 'apple_wallet',
      level: 'info',
      data: {
        certificates_count: certificates.length,
        has_leaf_cert: !!leafCert,
        has_subordinate_cert: !!subordinateCert,
      },
    });

    const response = await createAppleWalletProvision({
      nonce,
      nonceSignature,
      certificates: [leafCert, subordinateCert],
    });

    Sentry.addBreadcrumb({
      message: 'Apple Wallet payload encryption completed',
      category: 'apple_wallet',
      level: 'info',
      data: {
        has_encrypted_pass_data: !!response.encrypted_pass_data,
        has_activation_data: !!response.activation_data,
        has_ephemeral_public_key: !!response.ephemeral_public_key,
      },
    });

    return {
      encryptedPassData: response.encrypted_pass_data,
      activationData: response.activation_data,
      ephemeralPublicKey: response.ephemeral_public_key,
    };
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        type: 'apple_wallet_payload_encryption_error',
      },
      extra: {
        certificates_count: certificates.length,
        nonce_length: nonce.length,
        nonceSignature_length: nonceSignature.length,
      },
    });
    throw error;
  }
}

/**
 * Main function to add a card to Apple Wallet
 */
export async function addToAppleWallet(
  config: AppleWalletConfig,
  trackFn: (event: string, properties?: any) => void,
): Promise<AppleWalletProvisionResult> {
  if (Platform.OS !== 'ios') {
    const error = 'Apple Wallet is only available on iOS devices';

    Sentry.captureMessage(error, {
      tags: {
        type: 'apple_wallet_platform_error',
        platform: Platform.OS,
      },
      extra: {
        config,
      },
    });

    return {
      success: false,
      error,
    };
  }

  try {
    // Add breadcrumb for provisioning start
    Sentry.addBreadcrumb({
      message: 'Apple Wallet card provisioning started',
      category: 'apple_wallet',
      level: 'info',
      data: {
        network: config.network,
        last_digits: config.lastDigits,
        cardholder_name: config.cardHolderName,
      },
    });

    // Track the start of provisioning
    trackFn(TRACKING_EVENTS.ADD_TO_APPLE_PAY_STARTED, {
      network: config.network,
      last_digits: config.lastDigits,
    });

    await addCardToAppleWallet(config, issuerEncryptPayloadCallback);

    // Add breadcrumb for successful completion
    Sentry.addBreadcrumb({
      message: 'Apple Wallet card provisioning completed successfully',
      category: 'apple_wallet',
      level: 'info',
      data: {
        network: config.network,
        last_digits: config.lastDigits,
      },
    });

    // Track successful completion
    trackFn(TRACKING_EVENTS.ADD_TO_APPLE_PAY_COMPLETED, {
      network: config.network,
      last_digits: config.lastDigits,
    });

    return {
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // Capture the error with context
    Sentry.captureException(error, {
      tags: {
        type: 'apple_wallet_provisioning_error',
        network: config.network,
      },
      extra: {
        config,
        error_message: errorMessage,
        platform: Platform.OS,
      },
    });

    // Track failure
    trackFn(TRACKING_EVENTS.ADD_TO_APPLE_PAY_FAILED, {
      network: config.network,
      last_digits: config.lastDigits,
      error: errorMessage,
    });

    console.error('Apple Wallet provisioning failed:', error);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Check if a card can be added to Apple Wallet
 */
export async function checkCanAddToAppleWallet(
  config: AppleWalletConfig,
): Promise<AppleWalletCardStatus> {
  if (Platform.OS !== 'ios') {
    Sentry.addBreadcrumb({
      message: 'Apple Wallet status check skipped - not iOS',
      category: 'apple_wallet',
      level: 'info',
      data: {
        platform: Platform.OS,
        last_digits: config.lastDigits,
      },
    });

    return AppleWalletCardStatus.UNKNOWN;
  }

  try {
    Sentry.addBreadcrumb({
      message: 'Apple Wallet card status check started',
      category: 'apple_wallet',
      level: 'info',
      data: {
        last_digits: config.lastDigits,
      },
    });

    const cardStatus = await getCardStatusBySuffix(config.lastDigits);

    const finalStatus =
      cardStatus === 'active' ? AppleWalletCardStatus.ADDED : AppleWalletCardStatus.NOT_ADDED;

    Sentry.addBreadcrumb({
      message: 'Apple Wallet card status check completed',
      category: 'apple_wallet',
      level: 'info',
      data: {
        last_digits: config.lastDigits,
        raw_status: cardStatus,
        final_status: finalStatus,
      },
    });

    // CardStatus.ACTIVE means card is already in wallet
    // CardStatus.NOT_PROVISIONED means it can be added
    return finalStatus;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    Sentry.captureException(error, {
      tags: {
        type: 'apple_wallet_status_check_error',
      },
      extra: {
        config,
        error_message: errorMessage,
        platform: Platform.OS,
      },
    });

    console.error('Error checking Apple Wallet card status:', error);
    return AppleWalletCardStatus.UNKNOWN;
  }
}

// Re-export the AddToWalletButton for convenience
export { AddToWalletButton };
