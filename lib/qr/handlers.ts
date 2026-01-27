/**
 * QR Code Type-Specific Handlers
 *
 * Contains action handlers for each supported QR code type.
 * Each handler processes the parsed QR data and triggers
 * the appropriate navigation or action.
 */

import Toast from 'react-native-toast-message';
import { router } from 'expo-router';

import { SEND_MODAL } from '@/constants/modals';
import { useSendStore } from '@/store/useSendStore';

import {
  QRCodeType,
  QREIP681URI,
  QRENSName,
  QREthereumAddress,
  QRHandlerResult,
  QRParsedData,
  QRSolidProfile,
  QRWalletConnectV2,
} from './types';

/**
 * Handles Ethereum address QR codes by pre-filling the Send flow
 */
function handleEthereumAddress(data: QREthereumAddress): QRHandlerResult {
  const { setAddress, setSearchQuery, setModal } = useSendStore.getState();

  setAddress(data.address);
  setSearchQuery(data.address);

  // Navigate to Send form
  setTimeout(() => {
    setModal(SEND_MODAL.OPEN_FORM);
  }, 100);

  return {
    success: true,
    message: 'Address detected',
    data: { address: data.address },
  };
}

/**
 * Handles EIP-681 payment URIs by pre-filling Send flow with address and amount
 */
function handleEIP681URI(data: QREIP681URI): QRHandlerResult {
  const { setAddress, setSearchQuery, setAmount, setModal } = useSendStore.getState();

  if (!data.address) {
    return {
      success: false,
      message: 'Invalid payment URI: no address found',
    };
  }

  setAddress(data.address);
  setSearchQuery(data.address);

  // Set amount if provided (convert from wei to human-readable)
  if (data.value) {
    try {
      const weiValue = BigInt(data.value);
      const ethValue = Number(weiValue) / 1e18;
      setAmount(ethValue.toString());
    } catch {
      // Invalid value format, ignore
    }
  }

  // Navigate to Send form
  setTimeout(() => {
    setModal(SEND_MODAL.OPEN_FORM);
  }, 100);

  return {
    success: true,
    message: 'Payment request detected',
    data: {
      address: data.address,
      chainId: data.chainId,
      value: data.value,
    },
  };
}

/**
 * Handles WalletConnect v2 pairing URIs
 * NOTE: Actual WalletConnect integration is planned for future release
 */
function handleWalletConnectV2(data: QRWalletConnectV2): QRHandlerResult {
  // TODO: Integrate with WalletConnect v2 SDK
  // For now, show informational toast
  Toast.show({
    type: 'info',
    text1: 'WalletConnect',
    text2: 'WalletConnect pairing will be available soon',
    position: 'bottom',
    visibilityTime: 3000,
  });

  return {
    success: false,
    message: 'WalletConnect integration coming soon',
    data: { topic: data.topic },
  };
}

/**
 * Handles ENS name QR codes
 * NOTE: ENS resolution will be implemented in future release
 */
function handleENSName(data: QRENSName): QRHandlerResult {
  const { setSearchQuery } = useSendStore.getState();

  // Set the ENS name as search query for resolution
  setSearchQuery(data.name);

  // TODO: Resolve ENS name to address
  Toast.show({
    type: 'info',
    text1: 'ENS Name Detected',
    text2: `Resolving ${data.name}...`,
    position: 'bottom',
    visibilityTime: 2000,
  });

  return {
    success: true,
    message: 'ENS name detected',
    data: { name: data.name },
  };
}

/**
 * Handles Solid profile QR codes
 */
function handleSolidProfile(data: QRSolidProfile): QRHandlerResult {
  // Navigate to the profile (or Send if it's a wallet profile)
  Toast.show({
    type: 'info',
    text1: 'Solid Profile',
    text2: 'Profile viewing coming soon',
    position: 'bottom',
    visibilityTime: 3000,
  });

  return {
    success: false,
    message: 'Profile viewing coming soon',
    data: { profileId: data.profileId },
  };
}

/**
 * Handles unknown QR codes by showing an error
 */
function handleUnknown(): QRHandlerResult {
  Toast.show({
    type: 'error',
    text1: 'Unrecognized QR Code',
    text2: 'This QR code format is not supported',
    position: 'bottom',
    visibilityTime: 3000,
  });

  return {
    success: false,
    message: 'Unrecognized QR code format',
  };
}

/**
 * Main handler that routes to type-specific handlers
 */
export function handleQRCode(data: QRParsedData): QRHandlerResult {
  switch (data.type) {
    case QRCodeType.ETHEREUM_ADDRESS:
      return handleEthereumAddress(data);

    case QRCodeType.EIP_681_URI:
      return handleEIP681URI(data);

    // case QRCodeType.WALLET_CONNECT_V2:
    //   return handleWalletConnectV2(data);

    // case QRCodeType.ENS_NAME:
    //   return handleENSName(data);

    // case QRCodeType.SOLID_PROFILE:
    //   return handleSolidProfile(data);

    case QRCodeType.UNKNOWN:
    default:
      return handleUnknown();
  }
}

/**
 * Navigates back from the QR scanner with optional success/error handling
 */
export function navigateBackFromScanner(success: boolean = true): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    // Fallback to home if can't go back
    router.replace('/');
  }
}
