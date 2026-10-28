import { Platform, Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import Input from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { parseInviteCodeFromText } from '@/lib/referral/inviteCode';
import { formatUsdWhole } from '@/lib/referral/referralV4';
import { cn } from '@/lib/utils';

import type { ReferralInviteLookup } from '@/lib/types';

export type InviteCodeStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'valid'; lookup: Extract<ReferralInviteLookup, { valid: true }> }
  | { kind: 'invalid' }
  /** The lookup itself failed: say nothing, signup sends the code and the backend decides. */
  | { kind: 'unverified' };

/** "Dana invited you · $10 card credit". */
const validLine = (lookup: Extract<ReferralInviteLookup, { valid: true }>) => {
  const who = `${lookup.referrer.username} invited you`;
  if (lookup.offer) return `${who} · ${formatUsdWhole(lookup.offer.friendCreditUsd)} card credit`;
  if (lookup.legacyOffer) {
    return `${who} · ${formatUsdWhole(lookup.legacyOffer.friendRewardUsd)} in ${lookup.legacyOffer.payoutToken}`;
  }
  return who;
};

interface InviteCodeFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  isOpen: boolean;
  onOpen: () => void;
  status: InviteCodeStatus;
  /**
   * iOS only: the system paste control, offered when there is text on the
   * clipboard and no code yet. It pastes without the "allow paste" prompt —
   * which is why the clipboard is never read on its own.
   */
  showPasteButton: boolean;
  onPaste: (text: string) => void;
  labelClassName?: string;
}

/**
 * The optional "Invite code" on the signup screen: collapsed behind "Have an
 * invite code?" when there is none, prefilled and checked when a link, the
 * install referrer or a paste brought one. Whatever it holds is sent as the
 * signup's `referralCode`, exactly as a link's code always has been.
 */
const InviteCodeField = ({
  value,
  onChangeText,
  isOpen,
  onOpen,
  status,
  showPasteButton,
  onPaste,
  labelClassName,
}: InviteCodeFieldProps) => {
  const pasteControl =
    showPasteButton && Platform.OS === 'ios' && Clipboard.isPasteButtonAvailable ? (
      <View className="flex-row items-center justify-between gap-3 rounded-xl bg-[#1F1F1F] py-2 pl-4 pr-2">
        <Text className="flex-1 text-[15px] font-medium text-white/80">Paste invite</Text>
        <Clipboard.ClipboardPasteButton
          acceptedContentTypes={['plain-text']}
          displayMode="iconAndLabel"
          cornerStyle="capsule"
          backgroundColor="#2F2F2F"
          foregroundColor="#FFFFFF"
          style={{ width: 100, height: 36 }}
          onPress={data => {
            if (data.type === 'text') onPaste(data.text);
          }}
        />
      </View>
    ) : null;

  if (!isOpen) {
    return (
      <View className="gap-3">
        {pasteControl}
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          hitSlop={8}
          className="self-start active:opacity-70 web:hover:opacity-80"
        >
          <Text className="text-[15px] font-medium text-white/60 underline">
            Have an invite code?
          </Text>
        </Pressable>
      </View>
    );
  }

  // A bare code, a pasted invite link or `solid-invite:CODE` all count.
  const malformed = value.trim().length > 3 && !parseInviteCodeFromText(value);

  let statusLine: { text: string; tone: string } | null = null;
  if (malformed || status.kind === 'invalid') {
    statusLine = { text: 'Code not found', tone: 'text-red-400' };
  } else if (status.kind === 'checking') {
    statusLine = { text: 'Checking…', tone: 'text-white/40' };
  } else if (status.kind === 'valid') {
    statusLine = { text: validLine(status.lookup), tone: 'text-brand' };
  }

  return (
    <View className="gap-2">
      <Text className={cn('text-base text-white/60', labelClassName)}>Invite code</Text>
      {pasteControl}
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder="Optional"
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={80}
        className="bg-[#2F2F2F] font-normal"
        error={!!statusLine && statusLine.tone === 'text-red-400'}
        accessibilityLabel="Invite code"
      />
      {statusLine ? (
        <Text className={cn('text-[14px]', statusLine.tone)} accessibilityLiveRegion="polite">
          {statusLine.text}
        </Text>
      ) : null}
    </View>
  );
};

export default InviteCodeField;
