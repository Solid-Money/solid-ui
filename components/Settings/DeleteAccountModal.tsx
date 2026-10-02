import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';

import Input from '@/components/ui/input';
import { useTotalSavingsUSD } from '@/hooks/useTotalSavingsUSD';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { cn, formatBalanceUSD } from '@/lib/utils';

/**
 * What the user has to type before "Delete Account" does anything.
 *
 * Two taps used to be enough, and a user closed an account holding $28 that way
 * and then could not sign back in to reach it. Typing a word is the one step
 * that cannot happen by accident.
 */
export const DELETE_CONFIRMATION_WORD = 'DELETE';

/** Whether what was typed confirms the deletion. Case and stray spaces don't count against it. */
export const isDeleteConfirmation = (typed: string): boolean =>
  typed.trim().toUpperCase() === DELETE_CONFIRMATION_WORD;

/**
 * Tells the user what they still hold before they delete the account.
 *
 * Deleting does not move any money: it stays in their wallet, and a closed
 * account cannot sign in to reach it. Wallet and savings are the pots that
 * matter for that and are read the same way the home screen reads them; the
 * card is left out because its balance means different things per issuer, so
 * the figure is "at least" rather than the headline.
 *
 * Only mounted while the modal is open, so the balance queries don't run for
 * everyone who merely opens Account details.
 */
export function HeldBalanceWarning() {
  const { totalUSDExcludingVaultTokens: walletUsd } = useWalletTokens();
  const { data: savingsUsd } = useTotalSavingsUSD();

  const heldUsd = (walletUsd || 0) + (savingsUsd || 0);
  if (heldUsd < 0.01) return null;

  return (
    <View className="mb-6 flex-row gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
      <AlertTriangle size={20} color="#FF7D7D" />
      <View className="flex-1">
        <Text className="mb-1 text-base font-bold text-white">
          You still have at least {formatBalanceUSD(heldUsd)} in Solid
        </Text>
        <Text className="text-sm text-gray-300">
          Deleting your account doesn&apos;t move this money, and you won&apos;t be able to sign
          back in to reach it. Withdraw it or send it to another wallet first.
        </Text>
      </View>
    </View>
  );
}

type DeleteAccountModalProps = {
  visible: boolean;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * The last step before an account is closed.
 *
 * Closing locks the user out — every sign-in is refused afterwards, and only
 * support can reopen the account — so this asks for more than a tap: it shows
 * what the user still holds, and the delete button stays disabled until they
 * type {@link DELETE_CONFIRMATION_WORD}.
 */
export default function DeleteAccountModal({
  visible,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteAccountModalProps) {
  const [confirmationText, setConfirmationText] = useState('');
  const isConfirmed = isDeleteConfirmation(confirmationText);

  // Whatever was typed must not carry over to the next opening — including after a failed
  // attempt, which closes the modal from the parent rather than through `cancel`.
  useEffect(() => {
    if (!visible) setConfirmationText('');
  }, [visible]);

  const cancel = () => {
    if (isDeleting) return;
    onCancel();
  };

  const confirm = () => {
    if (!isConfirmed || isDeleting) return;
    onConfirm();
  };

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={cancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        enabled={Platform.OS !== 'web'}
        style={{ flex: 1 }}
      >
        <View className="flex-1 items-center justify-center bg-black/70 px-4">
          <View className="w-full max-w-sm rounded-3xl bg-[#1c1c1c] p-6">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-white">Delete Account</Text>
              <Pressable onPress={cancel} accessibilityLabel="Close">
                <X size={24} color="#ffffff" />
              </Pressable>
            </View>

            {visible && <HeldBalanceWarning />}

            <Text className="mb-6 text-base text-gray-300">
              Are you sure you want to delete your account? This action cannot be undone and will:
            </Text>

            <View className="mb-6">
              <Text className="mb-2 text-sm text-gray-300">• Remove all your data</Text>
              <Text className="mb-2 text-sm text-gray-300">• Cancel any active cards</Text>
              <Text className="mb-2 text-sm text-gray-300">• Delete your transaction history</Text>
              <Text className="text-sm text-gray-300">• Remove access to your wallet</Text>
            </View>

            <Text className="mb-2 text-sm text-gray-300">
              Type <Text className="font-bold text-white">{DELETE_CONFIRMATION_WORD}</Text> to
              confirm
            </Text>
            <Input
              value={confirmationText}
              onChangeText={setConfirmationText}
              placeholder={DELETE_CONFIRMATION_WORD}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              editable={!isDeleting}
              className="mb-6"
              accessibilityLabel={`Type ${DELETE_CONFIRMATION_WORD} to confirm`}
            />

            <View className="flex-row justify-between">
              <Pressable
                onPress={cancel}
                className="mr-2 flex-1 rounded-xl bg-gray-700 py-4"
                disabled={isDeleting}
              >
                <Text className="text-center font-semibold text-white">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={confirm}
                className={cn('ml-2 flex-1 rounded-xl py-4', {
                  'bg-red-400': isDeleting,
                  'bg-red-600': !isDeleting && isConfirmed,
                  'bg-red-600/40': !isDeleting && !isConfirmed,
                })}
                disabled={isDeleting || !isConfirmed}
                accessibilityLabel="Delete Account"
                accessibilityState={{ disabled: isDeleting || !isConfirmed }}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text
                    className={cn('text-center font-semibold', {
                      'text-white': isConfirmed,
                      'text-white/50': !isConfirmed,
                    })}
                  >
                    Delete Account
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
