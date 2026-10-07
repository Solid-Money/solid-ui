import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight, KeyRound, Pencil, Trash2 } from 'lucide-react-native';

import ResponsiveModal from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { PASSKEY_NAME_MAX_LENGTH, PasskeyActionResult } from '@/hooks/usePasskeyManager';
import { PasskeySummary } from '@/lib/api';
import { describePasskeyActivity } from '@/lib/utils';
import { getThisDeviceNoun } from '@/lib/utils/passkeyDevice';

type SheetStep = 'root' | 'rename' | 'remove';

/** Depth of each step, which is all `ResponsiveModal` needs to animate the right way. */
const STEP_DEPTH: Record<SheetStep | 'close', number> = { close: 0, root: 1, rename: 2, remove: 2 };

interface OptionRowProps {
  icon: ReactNode;
  label: string;
  description?: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

const OptionRow = ({
  icon,
  label,
  description,
  onPress,
  destructive,
  disabled,
}: OptionRowProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityHint={description}
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    className="flex-row items-center gap-3 px-4 py-4 web:hover:bg-white/5"
    style={disabled ? styles.disabled : undefined}
  >
    <View className="h-10 w-10 items-center justify-center rounded-full bg-white/10">{icon}</View>
    <View className="flex-1">
      <Text
        className={
          destructive ? 'text-base font-medium text-red-400' : 'text-base font-medium text-white'
        }
      >
        {label}
      </Text>
      {description ? <Text className="text-sm text-[#ACACAC]">{description}</Text> : null}
    </View>
    {destructive ? null : <ChevronRight size={18} color="#ACACAC" />}
  </Pressable>
);

interface PasskeyOptionsSheetProps {
  isOpen: boolean;
  /**
   * The passkey the sheet is about. Kept by the caller after closing, so the
   * sheet still has something to show while it animates away.
   */
  passkey: PasskeySummary | null;
  isThisDevice: boolean;
  /** The account's last passkey cannot be removed — see `usePasskeyManager`. */
  isOnlyPasskey: boolean;
  onClose: () => void;
  onRename: (passkey: PasskeySummary, name: string) => Promise<PasskeyActionResult>;
  onRemove: (passkey: PasskeySummary) => Promise<PasskeyActionResult>;
}

/**
 * One passkey's options: its details, Rename, and Remove.
 *
 * Renaming is a label Solid keeps, so it saves without a passkey prompt.
 * Removing is a change to the account and is approved with a passkey like any
 * other, after a confirmation that says what the user is about to lose — most
 * of all when it is the passkey on the device they are holding.
 */
const PasskeyOptionsSheet = ({
  isOpen,
  passkey,
  isThisDevice,
  isOnlyPasskey,
  onClose,
  onRename,
  onRemove,
}: PasskeyOptionsSheetProps) => {
  const [nav, setNav] = useState<{ step: SheetStep; from: SheetStep | 'close' }>({
    step: 'root',
    from: 'close',
  });
  const [name, setName] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every opening starts on the passkey's details, with nothing left over from last time.
  useEffect(() => {
    if (!isOpen) return;
    setNav({ step: 'root', from: 'close' });
    setName(passkey?.name ?? '');
    setError(null);
    setIsBusy(false);
  }, [isOpen, passkey?.authenticatorId, passkey?.name]);

  const goTo = (next: SheetStep) => {
    setError(null);
    setNav(current => ({ step: next, from: current.step }));
  };

  if (!passkey) return null;

  const trimmedName = name.trim();
  const canSaveName = !isBusy && trimmedName.length > 0 && trimmedName !== passkey.name;

  const handleRename = async () => {
    if (!canSaveName) return;
    setIsBusy(true);
    setError(null);
    const result = await onRename(passkey, trimmedName);
    setIsBusy(false);
    if (result.status === 'failed') setError(result.message);
    else if (result.status === 'done') goTo('root');
  };

  const handleRemove = async () => {
    setIsBusy(true);
    setError(null);
    const result = await onRemove(passkey);
    setIsBusy(false);
    if (result.status === 'failed') setError(result.message);
    else if (result.status === 'done') onClose();
  };

  const { step } = nav;

  return (
    <ResponsiveModal
      currentModal={{ name: step, number: STEP_DEPTH[step] }}
      previousModal={{ name: nav.from, number: STEP_DEPTH[nav.from] }}
      isOpen={isOpen}
      onOpenChange={open => {
        if (!open && !isBusy) onClose();
      }}
      trigger={null}
      title={step === 'rename' ? 'Rename passkey' : step === 'remove' ? 'Remove passkey?' : ''}
      hideHeader={step === 'root'}
      compactHeader
      showBackButton={step !== 'root'}
      onBackPress={() => goTo('root')}
      contentKey={step}
      mobilePresentation="drawer"
      contentClassName="md:max-w-[420px]"
    >
      {step === 'root' ? (
        <View>
          <View className="items-center pt-2">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-white/10">
              <KeyRound size={24} color="#FFFFFF" />
            </View>
            <Text className="mt-4 text-center text-2xl font-semibold text-white" numberOfLines={1}>
              {passkey.name}
            </Text>
            <Text className="mt-1 text-center text-sm text-[#ACACAC]">
              {describePasskeyActivity(passkey, { isThisDevice, detailed: true })}
            </Text>
          </View>

          <View className="mt-6 overflow-hidden rounded-2xl bg-[#2B2B2B]">
            <OptionRow
              icon={<Pencil size={18} color="#FFFFFF" />}
              label="Rename"
              onPress={() => goTo('rename')}
            />
            <View style={styles.divider} />
            <OptionRow
              icon={<Trash2 size={18} color="#F87171" />}
              label="Remove passkey"
              description={isOnlyPasskey ? "You can't remove your only passkey" : undefined}
              destructive
              disabled={isOnlyPasskey}
              onPress={() => goTo('remove')}
            />
          </View>

          <Button className="mt-4 h-12 rounded-full bg-[#2A2A2A]" onPress={onClose}>
            <Text className="text-base font-semibold text-white">Done</Text>
          </Button>
        </View>
      ) : step === 'rename' ? (
        <View>
          <Input
            className="h-[54px] rounded-[15px] bg-popover px-5 text-[16px] font-medium"
            value={name}
            onChangeText={text => {
              setName(text);
              setError(null);
            }}
            maxLength={PASSKEY_NAME_MAX_LENGTH}
            editable={!isBusy}
            error={!!error}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={handleRename}
            accessibilityLabel="Passkey name"
          />
          <Text className="mt-3 text-sm text-[#ACACAC]">
            Only you see this name in Solid. It doesn&apos;t change the passkey itself.
          </Text>
          {error ? <Text className="mt-3 text-sm text-red-400">{error}</Text> : null}
          <Button
            variant="brand"
            className="mt-6 h-12 rounded-full"
            disabled={!canSaveName}
            onPress={handleRename}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="black" />
            ) : (
              <Text className="text-base font-semibold text-black">Save</Text>
            )}
          </Button>
        </View>
      ) : (
        <View>
          <Text className="text-base leading-6 text-white">
            {passkey.name} will no longer be able to sign in or approve changes on your account.
          </Text>
          {isThisDevice ? (
            <View className="mt-4 rounded-2xl bg-[#2A2119] p-4">
              <Text className="text-sm leading-5 text-[#E8A33D]">
                This is the passkey on {getThisDeviceNoun()}. To keep using Solid here, you&apos;ll
                need one of your other passkeys — on another device or a security key.
              </Text>
            </View>
          ) : null}
          <Text className="mt-4 text-sm text-[#ACACAC]">
            You&apos;ll confirm with one of your passkeys.
          </Text>
          {error ? <Text className="mt-3 text-sm text-red-400">{error}</Text> : null}
          <Button
            className="mt-6 h-12 rounded-full bg-red-500/15"
            disabled={isBusy}
            onPress={handleRemove}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#F87171" />
            ) : (
              <Text className="text-base font-semibold text-red-400">Remove passkey</Text>
            )}
          </Button>
          <Button
            variant="ghost"
            className="mt-2 h-12 rounded-full"
            disabled={isBusy}
            onPress={() => goTo('root')}
          >
            <Text className="text-base font-medium text-white">Cancel</Text>
          </Button>
        </View>
      )}
    </ResponsiveModal>
  );
};

const styles = StyleSheet.create({
  divider: { backgroundColor: 'rgba(255, 255, 255, 0.1)', height: 1 },
  disabled: { opacity: 0.5 },
});

export default PasskeyOptionsSheet;
