import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, TextStyle, View } from 'react-native';
import { router } from 'expo-router';
import { Check, CircleAlert, Info, Trash2 } from 'lucide-react-native';

import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import {
  CardSheetBody,
  sheetBodyInset,
} from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet.types';
import SheetTextInput from '@/components/Card/NewCardDetails/SpendMode/SheetTextInput';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useCardTransactions } from '@/hooks/useCardTransactions';
import { usePortfolio } from '@/hooks/usePortfolio';
import useUser from '@/hooks/useUser';
import { cn, hasCard } from '@/lib/utils';

import {
  DELETE_CONFIRMATION_PHRASE,
  DeleteAccountCheck,
  getDeleteAccountChecks,
  getDeleteSheetSubtitle,
} from './deleteAccount';

const DANGER = '#FF7D7D';
const WARNING = '#F2B84B';
const POSITIVE = '#94F27F';
const MUTED = '#8E8E8E';

const INPUT_STYLE: TextStyle = {
  height: 52,
  width: '100%',
  borderRadius: 16,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.1)',
  backgroundColor: '#111111',
  paddingHorizontal: 16,
  fontSize: 16,
  color: '#FFFFFF',
};

const CheckIcon = ({ state }: { state: DeleteAccountCheck['state'] }) => {
  switch (state) {
    case 'loading':
      return <ActivityIndicator size="small" color={MUTED} />;
    case 'ok':
      return <Check size={18} color={POSITIVE} />;
    case 'info':
      return <Info size={18} color={MUTED} />;
    default:
      return <CircleAlert size={18} color={WARNING} />;
  }
};

interface DeleteAccountSheetBodyProps extends CardSheetBody {
  onClose: () => void;
}

/**
 * The sheet's contents, mounted only while it is open: the balance read behind
 * the checks is the whole portfolio, and Account details has no other use for it.
 */
const DeleteAccountSheetBody = ({
  session,
  topPadding,
  presentation,
  onClose,
}: DeleteAccountSheetBodyProps) => {
  const { handleDeleteAccount } = useUser();
  const portfolio = usePortfolio();
  const { data: cardStatus, isLoading: isCardStatusLoading } = useCardStatus();
  const userHasCard = hasCard(cardStatus);
  const cardTransactions = useCardTransactions({ enabled: userHasCard });
  const [confirmation, setConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfirmation('');
    setError(null);
  }, [session]);

  // Payments still settling are recent, so the first page holds any there are.
  const pendingCardPayments = cardTransactions.isError
    ? undefined
    : cardTransactions.data?.pages[0]?.data.filter(
        transaction => transaction.status?.toLowerCase() === 'pending',
      ).length;

  const { checks, canDelete } = useMemo(
    () =>
      getDeleteAccountChecks({
        balanceUsd: portfolio.totalAssets,
        isBalanceLoading: portfolio.isLoading,
        isBalanceComplete: portfolio.isComplete,
        hasCard: userHasCard,
        pendingCardPayments,
        isCardPaymentsLoading: isCardStatusLoading || (userHasCard && cardTransactions.isLoading),
      }),
    [
      portfolio.totalAssets,
      portfolio.isLoading,
      portfolio.isComplete,
      userHasCard,
      pendingCardPayments,
      isCardStatusLoading,
      cardTransactions.isLoading,
    ],
  );

  const isArmed =
    canDelete && confirmation.trim().toUpperCase() === DELETE_CONFIRMATION_PHRASE && !isDeleting;

  const confirmDelete = async () => {
    if (!isArmed) return;
    setIsDeleting(true);
    setError(null);
    try {
      // Signs out and leaves for onboarding on success, so there is nothing to close here.
      await handleDeleteAccount();
    } catch {
      setError("Couldn't delete your account. Please try again.");
      setIsDeleting(false);
    }
  };

  const openAssets = () => {
    onClose();
    router.push(path.ASSETS);
  };

  return (
    <View
      style={{ paddingTop: topPadding, paddingHorizontal: sheetBodyInset(presentation) }}
      className="items-center"
    >
      <View className="h-14 w-14 items-center justify-center rounded-full bg-[#FF7D7D]/15">
        <Trash2 size={24} color={DANGER} />
      </View>
      <Text className="mt-4 text-center text-xl font-semibold text-white">
        Delete your Solid account?
      </Text>
      <Text className="mt-2 text-center text-sm leading-5 text-[#ACACAC]">
        {getDeleteSheetSubtitle(userHasCard)}
      </Text>

      <View className="mt-5 w-full gap-4 rounded-2xl bg-[#2A2A2A] p-4">
        {checks.map(check => (
          <View key={check.id} className="flex-row items-start gap-3">
            <View className="h-5 w-5 items-center justify-center pt-0.5">
              <CheckIcon state={check.state} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-white">{check.title}</Text>
              {check.detail ? (
                <Text className="mt-0.5 text-sm text-[#8E8E8E]">{check.detail}</Text>
              ) : null}
            </View>
            {check.hasAction ? (
              <Pressable onPress={openAssets} accessibilityRole="link" hitSlop={8}>
                <Text className="text-base font-semibold text-[#94F27F]">Withdraw</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>

      <Text className="mb-2 mt-5 self-start text-sm text-[#ACACAC]">
        Type {DELETE_CONFIRMATION_PHRASE} to confirm
      </Text>
      <SheetTextInput
        accessibilityLabel={`Type ${DELETE_CONFIRMATION_PHRASE} to confirm`}
        className="web:outline-none"
        value={confirmation}
        onChangeText={setConfirmation}
        placeholder={DELETE_CONFIRMATION_PHRASE}
        placeholderTextColor="rgba(255,255,255,0.3)"
        selectionColor={DANGER}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        editable={!isDeleting}
        returnKeyType="done"
        onSubmitEditing={confirmDelete}
        style={INPUT_STYLE}
      />
      {error ? <Text className="mt-2 self-start text-sm text-red-400">{error}</Text> : null}

      <Pressable
        onPress={confirmDelete}
        disabled={!isArmed}
        accessibilityRole="button"
        accessibilityState={{ disabled: !isArmed, busy: isDeleting }}
        className={cn(
          'mt-5 h-[50px] w-full items-center justify-center rounded-full bg-[#FF7D7D]/20',
          isArmed ? 'active:opacity-80 web:hover:bg-[#FF7D7D]/30' : 'opacity-50',
        )}
      >
        {isDeleting ? (
          <ActivityIndicator color={DANGER} />
        ) : (
          <Text className="text-base font-semibold text-[#FF7D7D]">Delete account</Text>
        )}
      </Pressable>
      <Pressable
        onPress={onClose}
        disabled={isDeleting}
        accessibilityRole="button"
        className="mt-1 h-12 w-full items-center justify-center active:opacity-70"
      >
        <Text className="text-base font-semibold text-white">Keep my account</Text>
      </Pressable>
    </View>
  );
};

interface DeleteAccountSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Delete account (Figma "Delete your Solid account?").
 *
 * Lists what has to happen first — balance withdrawn, card payments settled —
 * and asks for the word DELETE before the button arms.
 */
const DeleteAccountSheet = ({ isOpen, onOpenChange }: DeleteAccountSheetProps) => (
  <CardBottomSheet
    isOpen={isOpen}
    onOpenChange={onOpenChange}
    contentKey="delete-account"
    designTop={36}
    designBottom={16}
  >
    {body => <DeleteAccountSheetBody {...body} onClose={() => onOpenChange(false)} />}
  </CardBottomSheet>
);

export default DeleteAccountSheet;
