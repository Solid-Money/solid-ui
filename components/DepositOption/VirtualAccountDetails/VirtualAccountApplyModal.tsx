import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { CountryDropdown, CountrySelector, filterCountries } from '@/components/CountryPicker';
import { OnboardingFeeSheet } from '@/components/DepositOption/VirtualAccountDetails/OnboardingFeeSheet';
import PinnedActionModalLayout from '@/components/PinnedActionModalLayout';
import { RegionUnavailableGeo, RegionUnavailableView } from '@/components/RegionUnavailable';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { COUNTRIES, Country } from '@/constants/countries';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useDimension } from '@/hooks/useDimension';
import { useOnboardingFeeQuote } from '@/hooks/useOnboardingFee';
import { useVirtualAccountProvider } from '@/hooks/useVirtualAccountProvider';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { checkProductAccess } from '@/lib/countryAccess';
import { detectGeo } from '@/lib/geo';
import { DepositModal, OnboardingFeeProduct } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { needsDocumentCountryCheck } from '@/lib/utils/virtualAccountDocumentCountry';
import { getVirtualAccountRainStatus } from '@/lib/utils/virtualAccountRainStatus';
import { useDepositStore } from '@/store/useDepositStore';
import { useKycStore } from '@/store/useKycStore';

import { resolveVirtualAccountApplyAction } from './virtualAccountApplyAction';

const BENEFITS_HEIGHT = 328;
const FIRST_ROW_HEIGHT = 177;
const HAIRLINE = 'rgba(255,255,255,0.1)';
const CTA_HEIGHT = 50;
// Clears the pinned 50pt back button, plus the gap the pitch leaves under it.
const DOCUMENT_STEP_TOP_GAP = 66;

interface Benefit {
  icon?: ReturnType<typeof getAsset>;
  iconHeight?: number;
  iconWidth?: number;
  label: string;
  textBadge?: string;
}

const BENEFITS: Benefit[] = [
  {
    icon: getAsset('images/virtual-account-bank.svg'),
    iconWidth: 26.5023,
    iconHeight: 23.3426,
    label: 'US account details\nin your name',
  },
  {
    icon: getAsset('images/virtual-account-ach-wire.svg'),
    iconWidth: 26.1729,
    iconHeight: 25.7073,
    label: 'Receive ACH\nand Wire\ntransfers',
  },
  {
    icon: getAsset('images/virtual-account-settlement.svg'),
    iconWidth: 28.5,
    iconHeight: 25.5001,
    label: 'Funds arrive in 1-3\nbusiness days',
  },
  {
    // The fee cell. It is the only place the charge is named before the sheet,
    // so it carries the number — and the number comes from the server, which is
    // why both it and the label are filled in by `BenefitsGrid`.
    label: '',
    textBadge: '',
  },
];

/**
 * The fee cell's badge and label, for a quoted charge.
 *
 * A $0 charge is a normal answer — the line ships off, and a country can be
 * exempted — and it is not "a one-time setup fee of nothing". It reads as what
 * it is, which is also exactly what this cell said before the fee existed.
 */
const feeCell = (feeUsd: number | undefined): Benefit => {
  if (feeUsd === undefined) return { label: '', textBadge: '' };
  if (feeUsd <= 0) return { label: 'No fees\nfrom Solid', textBadge: '$0' };

  return {
    label: 'One-time\nsetup fee',
    textBadge: `$${formatNumber(feeUsd, 2, 0)}`,
  };
};

const BenefitCell = ({ benefit }: { benefit: Benefit }) => (
  <View className="flex-1 items-center">
    <View style={styles.badge} className="items-center justify-center bg-white/10">
      {benefit.icon ? (
        <Image
          source={benefit.icon}
          style={{ width: benefit.iconWidth, height: benefit.iconHeight }}
          contentFit="fill"
        />
      ) : (
        // Empty while the fee quote is in flight. The circle stays, so the grid
        // does not reflow when the number arrives.
        <Text className="text-[20px] font-normal leading-6 text-white">{benefit.textBadge}</Text>
      )}
    </View>
    <Text className="mt-[9px] text-center text-[16px] font-medium leading-5 text-white">
      {benefit.label}
    </Text>
  </View>
);

const BenefitsGrid = ({
  horizontalMargin,
  feeUsd,
}: {
  horizontalMargin: number;
  /** The quoted charge. Undefined until the server answers. */
  feeUsd: number | undefined;
}) => (
  <View
    style={[styles.benefitsCard, { marginHorizontal: horizontalMargin }]}
    className="overflow-hidden bg-[#1C1C1C]"
  >
    <View style={styles.firstBenefitRow} className="flex-row">
      <BenefitCell benefit={BENEFITS[0]} />
      <BenefitCell benefit={BENEFITS[1]} />
    </View>
    <View style={styles.secondBenefitRow} className="flex-row">
      <BenefitCell benefit={BENEFITS[2]} />
      <BenefitCell benefit={feeCell(feeUsd)} />
    </View>
    <View pointerEvents="none" style={styles.horizontalDivider} />
    <View pointerEvents="none" style={styles.verticalDivider} />
  </View>
);

interface VirtualAccountApplyModalProps {
  onClose: () => void;
  onRequestDepositModal?: (modal: DepositModal) => void;
}

export const VirtualAccountApplyModal = ({
  onClose,
  onRequestDepositModal,
}: VirtualAccountApplyModalProps) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useDimension();
  const setModal = useDepositStore(state => state.setModal);
  const setKycFlow = useKycStore(state => state.setKycFlow);
  const { data: cardStatus } = useCardStatus();
  // Which issuer would open this user's account. `loading` is neither — the CTA
  // waits rather than guessing, because guessing Rain is what sent Wirex users
  // into a verification they had already passed.
  const { provider: virtualAccountProvider, isLoading: isResolvingProvider } =
    useVirtualAccountProvider();

  const [isChecking, setIsChecking] = useState(false);
  // Open once the region check passes. The sheet decides for itself whether
  // there is anything to pay, and calls back straight through when there isn't.
  const [isFeeSheetOpen, setIsFeeSheetOpen] = useState(false);

  // Read here as well as in the sheet so the grid's badge can show the real
  // charge — it is configured per country, so "$10" is not a safe constant.
  // Both reads hit one cached query.
  const { data: feeQuote } = useOnboardingFeeQuote(OnboardingFeeProduct.RAIN_VIRTUAL_ACCOUNT);
  // Set once we know the user's region isn't served — swaps the pitch for the
  // "everything else is live" pop-up.
  const [unsupportedRegion, setUnsupportedRegion] = useState<RegionUnavailableGeo | null>(null);

  // "Which country issued your ID?" — asked before the fee, because Rain gates
  // the virtual account on the identity document, not on residence. The IP only
  // preselects an answer; nothing is decided until the user confirms it.
  const [isDocumentCountryStep, setIsDocumentCountryStep] = useState(false);
  const [documentCountry, setDocumentCountry] = useState<Country | null>(null);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  // Set once the user picks by hand, so a late IP lookup cannot overwrite it.
  const pickedByHand = useRef(false);
  const filteredCountries = useMemo(() => filterCountries(countrySearch), [countrySearch]);

  // Funnel entry for the virtual account: everything downstream is measured
  // against how many people saw this pitch.
  useEffect(() => {
    track(TRACKING_EVENTS.VIRTUAL_ACCOUNT_PITCH_VIEWED);
  }, []);

  // The dialog itself sits inside the overlay's 8pt inset. Adding the device's
  // safe-area plus 7pt places the hero and back button at y=59 on the Figma frame.
  const heroTop = insets.top + 7;

  const requestDepositModal = useCallback(
    (modal: DepositModal) => {
      if (onRequestDepositModal) {
        onRequestDepositModal(modal);
        return;
      }

      setModal(modal);
    },
    [onRequestDepositModal, setModal],
  );

  const proceed = useCallback(() => {
    // The Rain row's state, not the primary row's. For a Wirex cardholder the
    // primary row is their Wirex card, so the flat field read "not started"
    // after Rain had approved them — and with a Rain consumer on file that sent
    // them to the passive pending page instead of the terms step.
    const rainStatus = getVirtualAccountRainStatus(cardStatus);
    const action = resolveVirtualAccountApplyAction({
      provider: virtualAccountProvider,
      rainApplicationStatus: rainStatus,
      rainKycApplicationEstablished: cardStatus?.rainKycApplicationEstablished,
    });

    // Wirex issues this user's account, not Rain, so no amount of Rain approval
    // opens one and the Didit VA workflow is the wrong check to send them to.
    // Their details screen owns activation, including the "verify with Sumsub
    // first" state.
    if (action.type === 'wirex-details') {
      track(TRACKING_EVENTS.VIRTUAL_ACCOUNT_KYC_REQUIRED, {
        provider: 'wirex',
        rain_application_status: rainStatus ?? 'not_started',
      });
      requestDepositModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_DETAILS);
      return;
    }

    if (action.type === 'rain-tos') {
      requestDepositModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_TOS);
      return;
    }

    // Everyone else is sent through identity verification first — the single
    // biggest drop-off in this flow, so it gets its own event.
    track(TRACKING_EVENTS.VIRTUAL_ACCOUNT_KYC_REQUIRED, {
      provider: 'rain',
      rain_application_status: rainStatus ?? 'not_started',
      kyc_application_established: Boolean(cardStatus?.rainKycApplicationEstablished),
    });

    setKycFlow('va');
    requestDepositModal(DEPOSIT_MODAL.CLOSE);

    // An application already exists, so a new verification would be refused
    // with 409 KYC_ALREADY_EXISTS and /kyc would bounce straight back out —
    // which is exactly what "Verify now" looked like from the outside. Send
    // them to the page that carries the application's real state instead.
    router.push(action.type === 'rain-application' ? path.CARD_PENDING : path.KYC);
  }, [cardStatus, requestDepositModal, router, setKycFlow, virtualAccountProvider]);

  /**
   * The verified KYC residence, when there is one — the document is checked
   * first, and this second. Never the IP: an IP is only a guess at where someone
   * is, so it may preselect the document country but must not send anyone to
   * the unavailable screen on its own. Returns the blocked country, or null when
   * there is nothing to block on (no KYC country, served, or the check failed —
   * the confirmed document answer stands then).
   */
  const findBlockedKycResidence = useCallback(async (): Promise<RegionUnavailableGeo | null> => {
    const kycCountry = cardStatus?.country?.toUpperCase();
    if (!kycCountry) return null;

    const hasAccess = await checkProductAccess('virtual_account', kycCountry);
    if (hasAccess !== false) return null;

    return {
      countryCode: kycCountry,
      countryName: COUNTRIES.find(c => c.code === kycCountry)?.name,
      detectionSource: 'kyc',
    };
  }, [cardStatus]);

  const handleApply = useCallback(() => {
    track(TRACKING_EVENTS.VIRTUAL_ACCOUNT_APPLY_PRESSED);

    // Wirex issues this user's account, so there is no Rain onboarding to pay
    // for and no Didit document check — their details screen owns activation,
    // including availability, from Wirex's own per-rail capabilities.
    if (virtualAccountProvider === 'wirex') {
      proceed();
      return;
    }

    // A document has already been through verification: nothing for the
    // question to prevent. The sheet passes straight through when already paid.
    if (!needsDocumentCountryCheck(cardStatus)) {
      setIsFeeSheetOpen(true);
      return;
    }

    setIsDocumentCountryStep(true);
  }, [cardStatus, proceed, virtualAccountProvider]);

  // Preselect the ID country from the IP. Only a suggestion: it is shown in the
  // field for the user to confirm or change, and a manual pick always wins.
  useEffect(() => {
    if (!isDocumentCountryStep) return;

    let cancelled = false;
    const preselect = async () => {
      const geo = await detectGeo();
      const detected = geo ? COUNTRIES.find(c => c.code === geo.countryCode.toUpperCase()) : null;

      track(TRACKING_EVENTS.VIRTUAL_ACCOUNT_DOCUMENT_COUNTRY_VIEWED, {
        detected_country_code: detected?.code ?? null,
      });

      if (cancelled || !detected || pickedByHand.current) return;
      setDocumentCountry(current => current ?? detected);
    };
    void preselect();

    return () => {
      cancelled = true;
    };
  }, [isDocumentCountryStep]);

  const handleOpenCountryDropdown = useCallback(() => {
    setCountrySearch('');
    setIsCountryDropdownOpen(true);
  }, []);

  const handleSelectDocumentCountry = useCallback((country: Country) => {
    pickedByHand.current = true;
    setDocumentCountry(country);
    setCountrySearch(country.name);
    setIsCountryDropdownOpen(false);
  }, []);

  // The only place this flow decides availability: on the country the user
  // confirmed, before any money moves.
  const handleConfirmDocumentCountry = useCallback(async () => {
    if (!documentCountry) return;

    setIsChecking(true);
    try {
      const hasAccess = await checkProductAccess('virtual_account', documentCountry.code);

      track(TRACKING_EVENTS.VIRTUAL_ACCOUNT_DOCUMENT_COUNTRY_CONFIRMED, {
        country_code: documentCountry.code,
        is_available: hasAccess,
        picked_by_hand: pickedByHand.current,
      });

      // A failed check is not a yes: charging on it is how users ended up
      // paying for an account their document could never open.
      if (hasAccess === null) {
        Toast.show({
          type: 'error',
          text1: "Couldn't check your country",
          text2: 'Please try again in a moment.',
          props: { badgeText: '' },
        });
        return;
      }

      if (!hasAccess) {
        track(TRACKING_EVENTS.VIRTUAL_ACCOUNT_REGION_BLOCKED, {
          country_code: documentCountry.code,
          detection_source: 'document',
        });
        setUnsupportedRegion({
          countryCode: documentCountry.code,
          countryName: documentCountry.name,
          detectionSource: 'manual',
        });
        return;
      }

      const blockedResidence = await findBlockedKycResidence();
      if (blockedResidence) {
        track(TRACKING_EVENTS.VIRTUAL_ACCOUNT_REGION_BLOCKED, {
          country_code: blockedResidence.countryCode,
          detection_source: 'kyc',
        });
        setUnsupportedRegion(blockedResidence);
        return;
      }

      setIsDocumentCountryStep(false);
      setIsFeeSheetOpen(true);
    } finally {
      setIsChecking(false);
    }
  }, [documentCountry, findBlockedKycResidence]);

  // "Change country" from the unavailable pop-up, back to the ID picker. Only
  // offered when the document answer is what blocked them: a verified
  // residence is not something they can pick their way past.
  const handleChangeDocumentCountry = useCallback(() => {
    setUnsupportedRegion(null);
    setIsDocumentCountryStep(true);
  }, []);

  const dismissFeeSheet = useCallback(() => {
    track(TRACKING_EVENTS.ONBOARDING_FEE_DISMISSED, {
      product: OnboardingFeeProduct.RAIN_VIRTUAL_ACCOUNT,
      fee_usd: feeQuote?.feeUsd ?? 0,
    });
    setIsFeeSheetOpen(false);
  }, [feeQuote?.feeUsd]);

  // Paid (or nothing was owed). Close the sheet before routing, so a user who
  // comes back to this screen does not find it still open over the pitch.
  const handleFeeSettled = useCallback(() => {
    setIsFeeSheetOpen(false);
    proceed();
  }, [proceed]);

  if (unsupportedRegion) {
    return (
      <RegionUnavailableView
        product="virtual_account"
        source="virtual_account_apply"
        geo={unsupportedRegion}
        onBack={onClose}
        onContinue={() => requestDepositModal(DEPOSIT_MODAL.CLOSE)}
        onChangeCountry={
          unsupportedRegion.detectionSource === 'manual' ? handleChangeDocumentCountry : undefined
        }
        // The dialog already sits inside the overlay's 8pt inset, so the
        // pop-up only needs the remaining 7pt to hit y=59 on the Figma frame.
        topOffset={7}
      />
    );
  }

  if (isDocumentCountryStep) {
    return (
      <PinnedActionModalLayout
        onBack={() => setIsDocumentCountryStep(false)}
        backTopOffset={heroTop}
        actionFadeExtent={60}
        actionHorizontalPadding={isDesktop ? 40 : 18}
        actionPaddingBottom={isDesktop ? 55 : 0}
        action={
          <Button
            variant="brand"
            className="w-full rounded-full border-0 active:opacity-90"
            style={{ height: CTA_HEIGHT }}
            onPress={handleConfirmDocumentCountry}
            disabled={!documentCountry || isChecking}
          >
            {isChecking ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="text-[16px] font-semibold text-black">Continue</Text>
            )}
          </Button>
        }
      >
        <View
          style={{
            paddingTop: heroTop + DOCUMENT_STEP_TOP_GAP,
            marginHorizontal: isDesktop ? 40 : 18,
          }}
        >
          <CountrySelector
            selectedCountry={documentCountry}
            onOpenDropdown={handleOpenCountryDropdown}
            showConfirmButton={false}
            title="Where is your ID from?"
            description="Select the country that issued the passport or ID card you'll verify with. We'll check it's supported before you pay the setup fee."
          />
        </View>
        <CountryDropdown
          visible={isCountryDropdownOpen}
          searchQuery={countrySearch}
          filteredCountries={filteredCountries}
          onClose={() => setIsCountryDropdownOpen(false)}
          onSearchChange={setCountrySearch}
          onCountrySelect={handleSelectDocumentCountry}
          inDialog
        />
      </PinnedActionModalLayout>
    );
  }

  return (
    <PinnedActionModalLayout
      onBack={onClose}
      topControl="close"
      backTopOffset={heroTop}
      actionFadeExtent={60}
      actionHorizontalPadding={isDesktop ? 40 : 18}
      actionPaddingBottom={isDesktop ? 55 : 0}
      action={
        <Button
          variant="brand"
          className="w-full rounded-full border-0 active:opacity-90"
          style={{ height: CTA_HEIGHT }}
          onPress={handleApply}
          disabled={isChecking || isResolvingProvider}
        >
          {isChecking || isResolvingProvider ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text className="text-[16px] font-semibold text-black">Continue</Text>
          )}
        </Button>
      }
    >
      <View style={{ paddingTop: heroTop }}>
        <View style={styles.heroImage} className="w-full overflow-hidden">
          <Image
            source={getAsset('images/virtual-account-hero-v2.png')}
            style={StyleSheet.absoluteFill}
            contentFit="fill"
          />
        </View>
      </View>

      <Text className="mt-[7px] self-center text-center text-[30px] font-medium leading-[30px] -tracking-[1px] text-white">
        USD Virtual{`\n`}account
      </Text>

      <Text className="mt-[6px] w-[332px] max-w-[85%] self-center text-center text-[16px] leading-5 text-white/70">
        Get a US bank account in your name to receive or deposit USD in your Solid Account
      </Text>

      <View className="mt-14">
        <BenefitsGrid horizontalMargin={isDesktop ? 40 : 18} feeUsd={feeQuote?.feeUsd} />
      </View>

      {isFeeSheetOpen ? (
        <OnboardingFeeSheet
          product={OnboardingFeeProduct.RAIN_VIRTUAL_ACCOUNT}
          onDismiss={dismissFeeSheet}
          onPaid={handleFeeSettled}
        />
      ) : null}
    </PinnedActionModalLayout>
  );
};

const styles = StyleSheet.create({
  heroImage: { aspectRatio: 419 / 233 },
  benefitsCard: { height: BENEFITS_HEIGHT, borderRadius: 23 },
  firstBenefitRow: {
    height: FIRST_ROW_HEIGHT,
    paddingTop: 23,
  },
  secondBenefitRow: { height: BENEFITS_HEIGHT - FIRST_ROW_HEIGHT, paddingTop: 24 },
  horizontalDivider: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: FIRST_ROW_HEIGHT,
    height: 1,
    backgroundColor: HAIRLINE,
  },
  verticalDivider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    marginLeft: -0.5,
    width: 1,
    backgroundColor: HAIRLINE,
  },
  badge: { width: 50, height: 49, borderRadius: 100 },
});
