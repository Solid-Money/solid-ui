import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { collateralDiscoveryKey } from '@/components/Card/Credit/collateralDiscovery';
import {
  assetName,
  CREDIT_COLORS,
  CreditSectionHelp,
  PillButton,
} from '@/components/Card/Credit/creditUi';
import { CreditCollateralMark, CreditGlyph } from '@/components/Card/Credit/loanSafetyUi';
import { formatLtv } from '@/components/Card/NewCardDetails/SpendMode/useCreditModeFigures';
import { getWalletDepositRow } from '@/components/DepositOption/WalletDepositAddress/constants';
import { useWalletDepositViewer } from '@/components/DepositOption/WalletDepositAddress/useWalletDepositViewer';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { WALLET_DEPOSIT_TOKENS } from '@/constants/walletDepositTokens';
import { useBaseCollateralCatalog } from '@/hooks/useCardCreditPositions';
import { useEuroSpendEnablement } from '@/hooks/useEuroSpendEnablement';
import { useOpenDepositFlow } from '@/hooks/useOpenDepositFlow';
import { useVaultDepositEntry } from '@/hooks/useVaultDepositEntry';
import { showErrorToast } from '@/lib/errors';
import {
  collateralAssetKeyOf,
  DEFAULT_COLLATERAL_ORDER,
  sortByCollateralOrder,
} from '@/lib/utils/collateralOrder';
import { LIVE_VAULTS } from '@/lib/vaults';
import { useDepositStore } from '@/store/useDepositStore';

import type { BaseCollateralPreview, CollateralCatalogAsset } from '@/hooks/useCardCreditPositions';
import type { VaultType } from '@/lib/types';

const PREVIEW_COUNT = 3;
const DEPOSIT_SOURCE = 'credit_collateral';

const AddButton = ({ name, onPress }: { name: string; onPress: () => void }) => (
  <Pressable
    accessibilityLabel={`Add ${name}`}
    accessibilityRole="button"
    className="shrink-0 rounded-full bg-white/10 px-4 py-[7px] active:opacity-70"
    hitSlop={4}
    onPress={onPress}
  >
    <Text className="text-[14px] font-semibold text-white">Add</Text>
  </Pressable>
);

const AddYield = ({ name, vaultType }: { name: string; vaultType: VaultType }) => {
  const { modal, onBeforeOpen } = useVaultDepositEntry(vaultType);
  const openDepositFlow = useOpenDepositFlow();

  return (
    <AddButton
      name={name}
      onPress={() => {
        onBeforeOpen();
        openDepositFlow({
          modal,
          source: DEPOSIT_SOURCE,
          buttonText: `Add ${name}`,
          preserveSelectedVault: true,
        });
      }}
    />
  );
};

const openCryptoDeposit = ({ chainId, symbol }: CollateralCatalogAsset) => {
  const { setModal, setWalletDeposit } = useDepositStore.getState();
  setWalletDeposit({ chainId, symbol, coin: undefined, isChangingToken: false, toSafe: true });
  setModal(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
};

const EnableBaseCollateral = () => {
  const base = useEuroSpendEnablement();
  if (!base.shouldOffer) return null;

  const enable = async () => {
    try {
      await base.enableAsync(DEPOSIT_SOURCE);
    } catch (error) {
      void showErrorToast(error, { action: 'card_settings' });
    }
  };

  return (
    <View style={styles.message}>
      <PillButton
        label="Turn on Base spending"
        size="compact"
        loading={base.isEnabling}
        onPress={() => void enable()}
      />
    </View>
  );
};

export const AdditionalCollateral = ({
  assets,
  heldAssets,
  baseCollateralPreview,
  isIncomplete,
  onHelpPress,
  onRetry,
}: {
  assets: readonly CollateralCatalogAsset[];
  heldAssets: readonly CollateralCatalogAsset[];
  baseCollateralPreview?: BaseCollateralPreview;
  isIncomplete: boolean;
  onHelpPress: () => void;
  onRetry: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const viewer = useWalletDepositViewer();
  const preview = !isIncomplete ? baseCollateralPreview : undefined;
  const baseCatalog = useBaseCollateralCatalog(preview?.moduleAddress);
  const knownKeys = new Set([...heldAssets, ...assets].map(collateralDiscoveryKey));
  const previewAssets = sortByCollateralOrder(
    (baseCatalog.data ?? []).filter(asset => {
      const key = collateralDiscoveryKey(asset);
      if (knownKeys.has(key)) return false;
      knownKeys.add(key);
      return true;
    }),
    asset => collateralAssetKeyOf(asset.symbol, asset.chainId),
    DEFAULT_COLLATERAL_ORDER,
  );
  const rows = [
    ...assets.map(asset => ({ asset, isPreview: false })),
    ...previewAssets.map(asset => ({ asset, isPreview: true })),
  ];
  const visible = expanded ? rows : rows.slice(0, PREVIEW_COUNT);
  const error = isIncomplete || (preview && baseCatalog.isError);
  const status = error
    ? 'We couldn’t load additional collateral right now.'
    : preview && baseCatalog.isPending
      ? 'Loading Base collateral…'
      : 'There are no additional collateral assets available for your card.';

  return (
    <View style={styles.section}>
      <View className="flex-row items-center gap-2">
        <Text className="text-[16px] text-white/50">More assets you can use</Text>
        <CreditSectionHelp label="Help with eligible collateral" onPress={onHelpPress} />
      </View>
      {preview && previewAssets.length > 0 ? (
        <Text className="text-[14px] leading-5 text-white/60">
          {preview.canEnable
            ? 'Turn on Base spending to use Base assets as collateral.'
            : 'Base assets require an app build that supports Base spending.'}
        </Text>
      ) : null}
      <View style={styles.card}>
        {visible.length === 0 ? (
          <View style={styles.message}>
            <Text className="text-[14px] leading-5 text-white/70">{status}</Text>
            {error ? (
              <PillButton
                label="Try again"
                size="compact"
                onPress={isIncomplete ? onRetry : () => void baseCatalog.refetch()}
              />
            ) : null}
          </View>
        ) : null}
        {visible.map(({ asset, isPreview }, index) => {
          const address = asset.token.toLowerCase();
          const vault = LIVE_VAULTS.find(candidate =>
            candidate.vaults.some(
              share => share.chainId === asset.chainId && share.address.toLowerCase() === address,
            ),
          );
          const name = vault?.vaultName ?? assetName(asset);
          const canDepositToken =
            !isPreview &&
            !vault &&
            WALLET_DEPOSIT_TOKENS.some(
              token =>
                token.symbol === asset.symbol &&
                token.contracts[asset.chainId]?.toLowerCase() === address,
            ) &&
            getWalletDepositRow(asset.chainId, asset.symbol, viewer).kind === 'own';
          return (
            <Fragment key={collateralDiscoveryKey(asset)}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.row}>
                <View style={styles.icon}>
                  <CreditCollateralMark symbol={asset.symbol} />
                </View>
                <View style={styles.assetText}>
                  <Text className="text-[16px] font-semibold text-white">{name}</Text>
                  <Text className="text-[14px] text-white/60">
                    {formatLtv(asset.ltvWad)}
                    {vault ? ' · keeps earning' : ''}
                  </Text>
                </View>
                {!isPreview && vault ? (
                  <AddYield name={name} vaultType={vault.type} />
                ) : canDepositToken ? (
                  <AddButton name={name} onPress={() => openCryptoDeposit(asset)} />
                ) : null}
              </View>
            </Fragment>
          );
        })}
        {rows.length > PREVIEW_COUNT ? (
          <>
            <View style={styles.divider} />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              className="flex-row items-center justify-center gap-1.5 py-3.5 active:opacity-70"
              onPress={() => setExpanded(current => !current)}
            >
              <Text className="text-[14px] text-white/50">
                {expanded ? 'See fewer assets' : `See all ${rows.length} assets`}
              </Text>
              {expanded ? null : <CreditGlyph name="next" />}
            </Pressable>
          </>
        ) : null}
        {preview?.canEnable ? (
          <>
            <View style={styles.divider} />
            <EnableBaseCollateral />
          </>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { gap: 12 },
  card: { backgroundColor: CREDIT_COLORS.card, borderRadius: 20, overflow: 'hidden' },
  divider: { backgroundColor: '#2A2A2A', height: 1 },
  message: { gap: 10, padding: 16 },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  icon: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40 },
  assetText: { flex: 1, gap: 3, minWidth: 0 },
});
