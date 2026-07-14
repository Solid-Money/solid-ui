import { useCallback } from 'react';
import { View } from 'react-native';
import { Check, ShieldCheck } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useShareTransfiKyc } from '@/hooks/useTransfi';
import { useDepositStore } from '@/store/useDepositStore';

const SHARED_ITEMS = [
  'Your legal name and date of birth',
  'Your verified ID document',
  'Your verification selfie',
];

/**
 * Consent screen shown when the user already has an approved Didit verification.
 * On agreement we forward that identity to TransFi (our payment partner) via
 * kyc/share/third-vendor, then move to the pending step to await approval.
 */
export const TransfiKycConsent = () => {
  const setModal = useDepositStore(state => state.setModal);
  const { mutate: share, isPending } = useShareTransfiKyc();

  const handleAgree = useCallback(() => {
    share(undefined, {
      onSuccess: result => {
        if (result.status === 'ready') {
          setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT);
        } else {
          setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_PENDING);
        }
      },
      onError: () => {
        setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_PENDING);
      },
    });
  }, [share, setModal]);

  return (
    <View className="flex-1 gap-6">
      <View className="items-center gap-4 pt-2">
        <View className="items-center justify-center rounded-full bg-card p-5">
          <ShieldCheck size={40} color="#94F27F" />
        </View>
        <View className="items-center gap-2 px-4">
          <Text className="text-center text-2xl font-bold text-primary">Verify to continue</Text>
          <Text className="text-center text-base text-muted-foreground">
            To buy crypto we&apos;ll securely share your verified identity with our payment partner
            TransFi. This lets you skip a second verification.
          </Text>
        </View>
      </View>

      <View className="gap-4 rounded-2xl bg-card p-5">
        <Text className="text-sm font-semibold text-muted-foreground">What we share</Text>
        {SHARED_ITEMS.map(item => (
          <View key={item} className="flex-row items-start gap-3">
            <Check size={16} color="#94F27F" style={{ marginTop: 2 }} />
            <Text className="flex-1 text-base leading-5 text-primary">{item}</Text>
          </View>
        ))}
      </View>

      <View className="mt-auto gap-3">
        <Button
          className="h-14 rounded-2xl"
          variant="brand"
          onPress={handleAgree}
          disabled={isPending}
        >
          <Text className="text-base font-bold text-primary-foreground">
            {isPending ? 'Sharing…' : 'Agree & continue'}
          </Text>
        </Button>
        <Button
          className="h-12 rounded-2xl"
          variant="ghost"
          onPress={() => setModal(DEPOSIT_MODAL.OPEN_OPTIONS)}
          disabled={isPending}
        >
          <Text className="text-base font-semibold text-muted-foreground">Cancel</Text>
        </Button>
      </View>
    </View>
  );
};

export default TransfiKycConsent;
