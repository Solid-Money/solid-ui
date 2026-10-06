import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AlertCircle, ChevronRight, KeyRound, Plus } from 'lucide-react-native';

import Navbar from '@/components/Navbar';
import PageLayout from '@/components/PageLayout';
import PasskeyOptionsSheet from '@/components/Passkeys/PasskeyOptionsSheet';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { usePasskey } from '@/hooks/usePasskey';
import { usePasskeyManager } from '@/hooks/usePasskeyManager';
import { PasskeySummary } from '@/lib/api';
import { cn, describePasskeyActivity } from '@/lib/utils';
import { getThisDeviceNoun } from '@/lib/utils/passkeyDevice';

interface PasskeyRowProps {
  passkey: PasskeySummary;
  isThisDevice: boolean;
  onPress: () => void;
}

const PasskeyRow = ({ passkey, isThisDevice, onPress }: PasskeyRowProps) => {
  const activity = describePasskeyActivity(passkey, { isThisDevice });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${passkey.name}${activity ? `, ${activity}` : ''}`}
      accessibilityHint="Opens options for this passkey"
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-4 active:opacity-70 web:hover:bg-[#2A2A2A]"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#2A2A2A]">
        <KeyRound size={18} color="#FFFFFF" />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-white" numberOfLines={1}>
          {passkey.name}
        </Text>
        {activity ? <Text className="text-sm text-[#ACACAC]">{activity}</Text> : null}
      </View>
      <ChevronRight size={18} color="#ACACAC" />
    </Pressable>
  );
};

/**
 * Settings → Security → Passkeys.
 *
 * Lists the passkeys that can sign in to the account and approve changes,
 * read live from Turnkey, and lets the user add, rename and remove them. Every
 * change that touches the account asks for a passkey, so there is no separate
 * unlock step in front of the screen.
 *
 * With a single passkey the screen leads with the case for a second one: that
 * passkey usually lives in one Apple or Google account, and losing it leaves
 * email recovery as the only way back — and no way back at all for accounts
 * without an email.
 */
export default function Passkeys() {
  const { isDesktop } = useDimension();
  const { isPasskeySupported } = usePasskey();
  const {
    passkeys,
    isLoading,
    isError,
    refetch,
    thisDeviceCredentialId,
    addPasskey,
    removePasskey,
    renamePasskey,
  } = usePasskeyManager();

  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PasskeySummary | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const hasOnePasskey = passkeys.length === 1;
  // Null while the browser is still being probed; passkeys always work in the app.
  const canAdd = isPasskeySupported !== false;

  const handleAdd = async () => {
    setIsAdding(true);
    setAddError(null);
    const result = await addPasskey();
    setIsAdding(false);
    if (result.status === 'failed') setAddError(result.message);
  };

  const openPasskey = (passkey: PasskeySummary) => {
    setSelected(passkey);
    setIsSheetOpen(true);
  };

  // The sheet reads the live entry, so a rename shows as soon as it saves.
  const selectedPasskey = selected
    ? (passkeys.find(item => item.authenticatorId === selected.authenticatorId) ?? selected)
    : null;

  const addButtonContent = isAdding ? (
    <ActivityIndicator size="small" color="black" />
  ) : (
    <>
      <Plus size={18} color="black" />
      <Text className="text-base font-semibold text-black">Add a passkey</Text>
    </>
  );

  const mobileHeader = (
    <View className="flex-row items-center justify-between px-4 py-3">
      <BackButton />
      <Text className="mr-[50px] flex-1 text-center text-xl font-bold text-white">Passkeys</Text>
    </View>
  );

  const desktopHeader = (
    <>
      <Navbar />
      <View className="mx-auto w-full max-w-[512px] px-4 pb-8 pt-8">
        <View className="mb-8 flex-row items-center justify-between">
          <BackButton />
          <Text className="text-3xl font-semibold text-white">Passkeys</Text>
          <View className="w-[50px]" />
        </View>
      </View>
    </>
  );

  return (
    <>
      <PageLayout
        customMobileHeader={mobileHeader}
        customDesktopHeader={desktopHeader}
        useDesktopBreakpoint
      >
        <View
          className={cn('mx-auto w-full px-4 py-4 pb-32', {
            'max-w-[512px]': isDesktop,
            'max-w-7xl': !isDesktop,
          })}
        >
          <Text className="text-base leading-6 text-[#ACACAC]">
            Sign in and approve changes with Face ID or your fingerprint. The private key stays in
            your device&apos;s keychain – Solid never has it.
          </Text>

          {hasOnePasskey && canAdd ? (
            <View className="mt-6 rounded-2xl border border-[#3D3020] bg-[#2A2119] p-4">
              <View className="flex-row gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-[#E8A33D]/15">
                  <AlertCircle size={18} color="#E8A33D" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-white">Add a backup passkey</Text>
                  <Text className="mt-1 text-sm leading-5 text-[#ACACAC]">
                    You have one passkey. A second one on another device keeps you in if you lose{' '}
                    {getThisDeviceNoun()} – no email recovery needed.
                  </Text>
                </View>
              </View>
              <Button
                variant="brand"
                className="mt-4 h-12 rounded-full"
                disabled={isAdding}
                onPress={handleAdd}
                accessibilityLabel="Add a passkey"
              >
                {addButtonContent}
              </Button>
            </View>
          ) : null}

          <Text className="mb-2 mt-8 text-sm font-medium text-[#ACACAC]">Your passkeys</Text>

          {isLoading ? (
            <View className="items-center rounded-2xl bg-[#1C1C1C] py-8">
              <ActivityIndicator size="small" color="#ACACAC" />
            </View>
          ) : isError ? (
            <View className="flex-row items-center gap-3 rounded-2xl bg-[#2A2119] p-4">
              <Text className="flex-1 text-sm text-[#E8A33D]">
                We couldn&apos;t load your passkeys.
              </Text>
              <Pressable onPress={() => void refetch()} accessibilityRole="button">
                <Text className="text-sm font-semibold text-white underline">Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View className="overflow-hidden rounded-2xl bg-[#1C1C1C]">
              {passkeys.map((passkey, index) => (
                <View key={passkey.authenticatorId}>
                  {index > 0 ? <View style={styles.divider} /> : null}
                  <PasskeyRow
                    passkey={passkey}
                    isThisDevice={passkey.credentialId === thisDeviceCredentialId}
                    onPress={() => openPasskey(passkey)}
                  />
                </View>
              ))}
            </View>
          )}

          {!hasOnePasskey && passkeys.length > 0 && canAdd ? (
            <Button
              className="mt-4 h-12 rounded-full bg-[#1C1C1C] web:hover:bg-[#2A2A2A]"
              disabled={isAdding}
              onPress={handleAdd}
              accessibilityLabel="Add a passkey"
            >
              {isAdding ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Plus size={18} color="white" />
                  <Text className="text-base font-semibold text-white">Add a passkey</Text>
                </>
              )}
            </Button>
          ) : null}

          {addError ? <Text className="mt-3 text-sm text-red-400">{addError}</Text> : null}

          {isPasskeySupported === false ? (
            <Text className="mt-3 text-sm text-[#ACACAC]">
              This browser can&apos;t create passkeys. Open Solid in Safari or Chrome, or in the
              app, to add one.
            </Text>
          ) : null}

          <Text className="mt-3 text-sm leading-5 text-[#ACACAC]">
            A removed passkey can no longer sign in or approve changes.
            {hasOnePasskey ? " You can't remove your only passkey." : ''}
          </Text>
        </View>
      </PageLayout>

      <PasskeyOptionsSheet
        isOpen={isSheetOpen}
        passkey={selectedPasskey}
        isThisDevice={!!selectedPasskey && selectedPasskey.credentialId === thisDeviceCredentialId}
        isOnlyPasskey={passkeys.length <= 1}
        onClose={() => setIsSheetOpen(false)}
        onRename={renamePasskey}
        onRemove={removePasskey}
      />
    </>
  );
}

const styles = StyleSheet.create({
  divider: { backgroundColor: 'rgba(255, 255, 255, 0.08)', height: 1, marginLeft: 68 },
});
