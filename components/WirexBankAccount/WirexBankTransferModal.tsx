import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import PinnedActionModalLayout from '@/components/PinnedActionModalLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import {
  useCreateWirexBankTransfer,
  useEstimateWirexBankTransfer,
} from '@/hooks/useWirexBankAccounts';
import { track } from '@/lib/analytics';
import {
  WirexBankAccountType,
  WirexBankRailStatusDto,
  WirexBankTransferDto,
  WirexBankTransferEstimateDto,
} from '@/lib/types/wirex-bank';
import { formatIban } from '@/lib/utils/iban';

import {
  EMPTY_TRANSFER_FORM,
  toEstimateRequest,
  validateTransferForm,
  WirexTransferFormErrors,
  WirexTransferFormState,
} from './transferFormState';
import { WirexBankTransferForm } from './WirexBankTransferForm';
import { WirexBankTransferReview } from './WirexBankTransferReview';

const CTA_HEIGHT = 50;

type Step = 'form' | 'review' | 'done';

/**
 * Turn a failed API Response into something worth showing a user.
 *
 * The backend answers a validation failure with `{ message, field, issue }`, so
 * the specific reason ("IBAN check digits do not match") is available — falling
 * back to a generic line only when it genuinely is not.
 */
async function describeFailure(error: unknown): Promise<string> {
  if (error instanceof Response) {
    try {
      const body: unknown = await error.json();
      const message = (body as { message?: unknown })?.message;
      if (typeof message === 'string' && message) return message;
      // Nest wraps a thrown object under `response` for some exception shapes.
      if (Array.isArray(message) && typeof message[0] === 'string') {
        return message[0];
      }
    } catch {
      // Non-JSON body; fall through.
    }
    if (error.status === 403) {
      return 'Transfers are not enabled on your account yet.';
    }
  }
  return 'Something went wrong. Please try again.';
}

export interface WirexBankTransferModalProps {
  rail: WirexBankRailStatusDto;
  onClose: () => void;
  /** Called once the transfer is accepted, with the created activity. */
  onSuccess?: (transfer: WirexBankTransferDto) => void;
}

/**
 * Send money out over SEPA or ACH.
 *
 * Two steps, because Wirex prices a transfer before it executes one: the form
 * collects the recipient, the review shows what each of the user's tokens would
 * cost and pins that quote. Execution always carries the estimation id, so the
 * amount charged is the amount confirmed here.
 */
export const WirexBankTransferModal = ({
  rail,
  onClose,
  onSuccess,
}: WirexBankTransferModalProps) => {
  const { isDesktop } = useDimension();
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState<WirexTransferFormState>(EMPTY_TRANSFER_FORM);
  const [errors, setErrors] = useState<WirexTransferFormErrors>({});
  const [estimate, setEstimate] = useState<WirexBankTransferEstimateDto | null>(null);
  const [selectedToken, setSelectedToken] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<WirexBankTransferDto | null>(null);

  const estimateMutation = useEstimateWirexBankTransfer();
  const createMutation = useCreateWirexBankTransfer();

  const isSepa = rail.accountType === WirexBankAccountType.SEPA;

  /** How the destination reads on the review screen — grouped, never truncated. */
  const recipientAccountDisplay = useMemo(
    () =>
      isSepa ? formatIban(form.iban) : `••••${form.accountNumber.replace(/\D/g, '').slice(-4)}`,
    [isSepa, form.iban, form.accountNumber],
  );

  const recipientName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();

  const handleReview = useCallback(async () => {
    setFailure(null);
    const validation = validateTransferForm(rail.accountType, form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    track(TRACKING_EVENTS.VIRTUAL_ACCOUNT_APPLY_PRESSED, {
      provider: 'wirex',
      rail: rail.accountType,
      step: 'estimate',
    });

    try {
      const result = await estimateMutation.mutateAsync(toEstimateRequest(rail.accountType, form));
      if (!result) throw new Error('No estimate returned');
      setEstimate(result);
      // Default to the first option — Wirex returns them in its own preference
      // order, and a single-token user should not have to pick.
      setSelectedToken(result.estimatedAmounts[0]?.tokenAddress);
      setStep('review');
    } catch (error) {
      setFailure(await describeFailure(error));
    }
  }, [estimateMutation, form, rail.accountType]);

  const handleConfirm = useCallback(async () => {
    if (!estimate || !selectedToken) return;
    setFailure(null);

    try {
      const result = await createMutation.mutateAsync({
        ...toEstimateRequest(rail.accountType, form),
        tokenAddress: selectedToken,
        // Pins the quote the user just confirmed; without it Wirex re-prices.
        estimationId: estimate.estimationId,
      });
      if (!result) throw new Error('No transfer returned');
      setTransfer(result);
      setStep('done');
      onSuccess?.(result);
    } catch (error) {
      setFailure(await describeFailure(error));
    }
  }, [createMutation, estimate, form, onSuccess, rail.accountType, selectedToken]);

  const isBusy = estimateMutation.isPending || createMutation.isPending;

  const action = (() => {
    if (step === 'done') {
      return (
        <Button
          variant="brand"
          className="w-full rounded-full border-0 active:opacity-90"
          style={{ height: CTA_HEIGHT }}
          onPress={onClose}
        >
          <Text className="text-[16px] font-semibold text-black">Done</Text>
        </Button>
      );
    }

    const isReview = step === 'review';
    const disabled = isBusy || (isReview && (!selectedToken || !estimate?.estimatedAmounts.length));

    return (
      <Button
        variant="brand"
        className="w-full rounded-full border-0 active:opacity-90"
        style={{ height: CTA_HEIGHT }}
        onPress={isReview ? handleConfirm : handleReview}
        disabled={disabled}
      >
        {isBusy ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text className="text-[16px] font-semibold text-black">
            {isReview ? 'Confirm transfer' : 'Review transfer'}
          </Text>
        )}
      </Button>
    );
  })();

  return (
    <PinnedActionModalLayout
      onBack={step === 'review' ? () => setStep('form') : onClose}
      topControl={step === 'review' ? 'back' : 'close'}
      actionHorizontalPadding={isDesktop ? 40 : 18}
      actionPaddingBottom={isDesktop ? 55 : 0}
      action={action}
    >
      <View className="flex-1 gap-4 pt-4">
        <Text className="text-[22px] font-semibold text-white">
          {step === 'done'
            ? 'Transfer submitted'
            : `Send ${rail.currency} by ${isSepa ? 'SEPA' : 'ACH'}`}
        </Text>

        {step === 'form' && (
          <WirexBankTransferForm
            accountType={rail.accountType}
            currency={rail.currency}
            form={form}
            onChange={setForm}
            errors={errors}
          />
        )}

        {step === 'review' && estimate && (
          <WirexBankTransferReview
            estimate={estimate}
            recipientName={recipientName}
            recipientAccountDisplay={recipientAccountDisplay}
            reference={form.reference.trim() || undefined}
            selectedTokenAddress={selectedToken}
            onSelectToken={setSelectedToken}
          />
        )}

        {step === 'done' && transfer && (
          <View className="gap-3 pt-2">
            <Text className="text-[16px] leading-6 text-white/70">
              {transfer.amount.toFixed(2)} {transfer.currency} is on its way to{' '}
              {transfer.recipientName} (••••{transfer.recipientAccountLast4}).
            </Text>
            <Text className="text-[15px] leading-5 text-white/50">
              {isSepa
                ? 'SEPA transfers usually settle within 1-2 business days.'
                : 'ACH transfers usually settle within 1-3 business days.'}{' '}
              You can track it in your activity.
            </Text>
          </View>
        )}

        {failure ? <Text className="text-[14px] leading-5 text-red-400">{failure}</Text> : null}
      </View>
    </PinnedActionModalLayout>
  );
};
