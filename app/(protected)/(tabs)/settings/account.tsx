import { useState } from 'react';
import { View } from 'react-native';
import { Href, router } from 'expo-router';
import { CircleCheck, Mail, Trash2, UserRound, Wallet } from 'lucide-react-native';
import { Address } from 'viem';

import CopyToClipboard from '@/components/CopyToClipboard';
import Navbar from '@/components/Navbar';
import PageLayout from '@/components/PageLayout';
import { DELETE_ACCOUNT_FOOTNOTE } from '@/components/Profile/deleteAccount';
import DeleteAccountSheet from '@/components/Profile/DeleteAccountSheet';
import { ProfileRow, ProfileRowGroup, ProfileSectionLabel } from '@/components/Profile/ProfileRow';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { KycStatus } from '@/lib/types';
import { cn, eclipseAddress } from '@/lib/utils';
import { isKycAwaitingDecision } from '@/lib/utils/kyc/verificationProgress';

const ICON_SIZE = 18;
const ICON_COLOR = '#FFFFFF';

/**
 * Settings → Account details (Figma "Account details").
 *
 * Who the account is — username, email, whether identity is verified — the
 * wallet it holds, and at the bottom the way to close it.
 */
export default function Account() {
  const { user } = useUser();
  const { isDesktop } = useDimension();
  const { data: cardStatus, isLoading: isCardStatusLoading } = useCardStatus();
  const [isDeleteSheetOpen, setIsDeleteSheetOpen] = useState(false);

  // Email-first signups get a generated `user_…` handle nobody chose or uses.
  const username = user?.username && !user.username.startsWith('user_') ? user.username : undefined;

  const verification =
    cardStatus?.kycStatus === KycStatus.APPROVED
      ? { badge: 'Verified' }
      : isKycAwaitingDecision(cardStatus)
        ? { value: 'In review' }
        : { value: 'Not verified' };

  const mobileHeader = (
    <View className="flex-row items-center justify-between px-4 py-3">
      <BackButton />
      <Text className="mr-[50px] flex-1 text-center text-xl font-bold text-white">
        Account details
      </Text>
    </View>
  );

  const desktopHeader = (
    <>
      <Navbar />
      <View className="mx-auto w-full max-w-[512px] px-4 pb-8 pt-8">
        <View className="mb-8 flex-row items-center justify-between">
          <BackButton />
          <Text className="text-3xl font-semibold text-white">Account details</Text>
          <View className="w-[50px]" />
        </View>
      </View>
    </>
  );

  return (
    <PageLayout
      customMobileHeader={mobileHeader}
      customDesktopHeader={desktopHeader}
      useDesktopBreakpoint
      additionalContent={
        <DeleteAccountSheet isOpen={isDeleteSheetOpen} onOpenChange={setIsDeleteSheetOpen} />
      }
      scrollable={false}
    >
      <View
        className={cn('mx-auto w-full flex-1 px-4 pb-4', {
          'max-w-[512px]': isDesktop,
          'max-w-7xl': !isDesktop,
        })}
      >
        <View>
          <Text className="mb-2 mt-2 text-sm text-[#8E8E8E]">Profile</Text>
          <ProfileRowGroup>
            {username ? (
              <ProfileRow
                icon={<UserRound size={ICON_SIZE} color={ICON_COLOR} />}
                title="Username"
                subtitle={`@${username}`}
                accessory={
                  <CopyToClipboard text={username} size={18} iconClassName="text-white/70" />
                }
              />
            ) : null}
            <ProfileRow
              icon={<Mail size={ICON_SIZE} color={ICON_COLOR} />}
              title="Email"
              subtitle={user?.email || 'Not set'}
              onPress={() => router.push('/settings/email' as Href)}
              accessibilityLabel={user?.email ? 'Change email' : 'Add an email'}
            />
            <ProfileRow
              icon={<CircleCheck size={ICON_SIZE} color={ICON_COLOR} />}
              title="Identity verification"
              isLoading={isCardStatusLoading}
              {...verification}
            />
          </ProfileRowGroup>

          <ProfileSectionLabel>Wallet</ProfileSectionLabel>
          <ProfileRowGroup>
            <ProfileRow
              icon={<Wallet size={ICON_SIZE} color={ICON_COLOR} />}
              title="Wallet address"
              subtitle={user?.safeAddress ? eclipseAddress(user.safeAddress as Address) : '—'}
              accessory={
                user?.safeAddress ? (
                  <CopyToClipboard
                    text={user.safeAddress}
                    size={18}
                    iconClassName="text-white/70"
                  />
                ) : null
              }
            />
          </ProfileRowGroup>
          <Text className="mt-2 px-1 text-sm leading-5 text-[#8E8E8E]">
            This is your self-custodial wallet. Only you can move funds out of it.
          </Text>
        </View>

        <View className="flex-1" />

        <View className={cn('pt-6', { 'pb-24': !isDesktop })}>
          <ProfileRowGroup>
            <ProfileRow
              icon={<Trash2 size={ICON_SIZE} color="#FF7D7D" />}
              title="Delete account"
              tone="danger"
              onPress={() => setIsDeleteSheetOpen(true)}
            />
          </ProfileRowGroup>
          <Text className="mt-2 px-1 text-sm leading-5 text-[#8E8E8E]">
            {DELETE_ACCOUNT_FOOTNOTE}
          </Text>
        </View>
      </View>
    </PageLayout>
  );
}
