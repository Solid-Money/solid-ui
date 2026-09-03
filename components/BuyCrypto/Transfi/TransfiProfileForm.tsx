import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import Input from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useBuyCryptoKycRoute } from '@/hooks/useBuyCryptoKycRoute';
import { useCompleteTransfiProfile } from '@/hooks/useTransfi';
import { track } from '@/lib/analytics';
import { asTransfiError } from '@/lib/transfiErrors';
import { TransfiProfileInput } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';
import { useTransfiStore } from '@/store/useTransfiStore';

/**
 * Fills the gap left by an identity verification that didn't carry everything
 * TransFi requires.
 *
 * This exists because there is no link we could send the user to instead:
 * TransFi's hosted KYC is keyed on a TransFi user id, and creating that user is
 * exactly what the missing address blocks. So we collect the fields here, the
 * backend keeps them beside the verified identity, and the share is retried —
 * turning a dead end into one screen.
 */
export const TransfiProfileForm = () => {
  const setModal = useDepositStore(state => state.setModal);
  const error = useTransfiStore(state => state.error);
  const setError = useTransfiStore(state => state.setError);
  const routeToKyc = useBuyCryptoKycRoute();
  const { mutate: complete, isPending } = useCompleteTransfiProfile();
  const [submitError, setSubmitError] = useState<string>();

  const missing = useMemo(() => error?.details.missing ?? [], [error?.details.missing]);
  const needsAddress = missing.includes('residential address');
  const needsPhone = missing.includes('phone number');

  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    track(TRACKING_EVENTS.BUY_CRYPTO_PROFILE_FORM_VIEWED, { missing: missing.join(', ') });
  }, [missing]);

  // The backend validates a national number without its prefix, so the two are
  // captured separately rather than parsed out of one free-text field.
  const addressReady = !needsAddress || (!!street.trim() && !!city.trim() && !!postalCode.trim());
  const phoneReady = !needsPhone || (/^\+?\d{1,4}$/.test(phoneCode) && /^\d{4,15}$/.test(phone));
  const isValid = addressReady && phoneReady && (needsAddress || needsPhone);

  const handleSubmit = () => {
    if (!isValid) return;
    setSubmitError(undefined);
    const payload: TransfiProfileInput = {
      ...(needsAddress && {
        street: street.trim(),
        city: city.trim(),
        ...(state.trim() && { state: state.trim() }),
        postalCode: postalCode.trim(),
      }),
      ...(needsPhone && { phone, phoneCode }),
    };
    complete(payload, {
      onSuccess: status => {
        track(TRACKING_EVENTS.BUY_CRYPTO_PROFILE_FORM_SUBMITTED, { status: status.status });
        setError(null);
        // The share ran again with the new details, so route on its verdict the
        // same way the consent screen does rather than assuming success.
        if (status.status === 'ready') {
          setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT);
        } else if (status.status === 'needs_kyc') {
          void routeToKyc(status.kycProvider);
        } else {
          setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_PENDING);
        }
      },
      onError: err => {
        const transfiError = asTransfiError(err);
        track(TRACKING_EVENTS.BUY_CRYPTO_PROFILE_FORM_FAILED, { code: transfiError.code });
        // Keep the user on the form with what they typed: a second attempt is
        // usually a corrected postcode, not a different screen.
        setSubmitError(transfiError.message);
      },
    });
  };

  return (
    <View className="flex-1 gap-4">
      <Text className="text-base text-muted-foreground">
        Our payment partner needs a little more before you can buy crypto. This is only used to
        verify your account.
      </Text>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3"
        keyboardShouldPersistTaps="handled"
      >
        {needsAddress ? (
          <View className="gap-3">
            <Text className="text-sm font-semibold text-muted-foreground">Residential address</Text>
            <Input
              value={street}
              onChangeText={setStreet}
              placeholder="Street and number"
              autoComplete="street-address"
            />
            <Input value={city} onChangeText={setCity} placeholder="City" />
            <View className="flex-row gap-3">
              <Input
                className="flex-1"
                value={state}
                onChangeText={setState}
                placeholder="State (optional)"
              />
              <Input
                className="flex-1"
                value={postalCode}
                onChangeText={setPostalCode}
                placeholder="Postcode"
              />
            </View>
          </View>
        ) : null}

        {needsPhone ? (
          <View className="gap-3">
            <Text className="text-sm font-semibold text-muted-foreground">Phone number</Text>
            <View className="flex-row gap-3">
              <Input
                className="w-24"
                value={phoneCode}
                onChangeText={t => setPhoneCode(t.replace(/[^0-9+]/g, ''))}
                placeholder="+1"
                keyboardType="phone-pad"
              />
              <Input
                className="flex-1"
                value={phone}
                onChangeText={t => setPhone(t.replace(/[^0-9]/g, ''))}
                placeholder="5551234567"
                keyboardType="phone-pad"
              />
            </View>
          </View>
        ) : null}

        {submitError ? <Text className="text-sm text-red-500">{submitError}</Text> : null}
      </ScrollView>

      <View className="gap-3">
        <Button
          className="h-14 rounded-2xl"
          variant="brand"
          onPress={handleSubmit}
          disabled={!isValid || isPending}
        >
          <Text className="text-base font-bold text-primary-foreground">
            {isPending ? 'Saving…' : 'Save and continue'}
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

export default TransfiProfileForm;
