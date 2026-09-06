import { Platform } from 'react-native';

/** Digital wallet type for add-to-wallet (Apple / Google). */
export enum DigitalWalletType {
  Apple = 'apple',
  Google = 'google',
}

/**
 * The wallet this device can add a card to, or null where there isn't one.
 *
 * The platform decides, because a card can only be provisioned into the wallet
 * of the phone in your hand — and desktop web has no wallet of its own, which is
 * why the home "Add to …" banner does not appear there.
 */
export const DEVICE_DIGITAL_WALLET: DigitalWalletType | null =
  Platform.OS === 'ios'
    ? DigitalWalletType.Apple
    : Platform.OS === 'android'
      ? DigitalWalletType.Google
      : null;

/**
 * Narrow a URL query value to a wallet, or null when it names neither.
 *
 * Params arrive as untrusted strings — a truncated deep link, an old push
 * payload — so anything unrecognised has to mean "no wallet asked for" rather
 * than defaulting to one of them and showing the wrong instructions.
 */
export function resolveDigitalWallet(value?: string | null): DigitalWalletType | null {
  return value === DigitalWalletType.Apple || value === DigitalWalletType.Google ? value : null;
}
