import { router } from 'expo-router';
import { ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, Text, View } from 'react-native';

import WalletIcon from '@/assets/images/wallet';
import CopyToClipboard from '@/components/CopyToClipboard';
import Navbar from '@/components/Navbar';
import PageLayout from '@/components/PageLayout';
import { SettingsCard } from '@/components/Settings';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { cn, eclipseAddress, getUserDisplayName } from '@/lib/utils';
import { Address } from 'viem';

import { getAsset } from '@/lib/assets';

const AccountDetailsIcon = getAsset('images/settings_account_details.png');

export default function Account() {
  const { user, handleDeleteAccount } = useUser();
  const { isDesktop } = useDimension();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeletePress = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await handleDeleteAccount();
    } catch (_error) {
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const mobileHeader = (
    <View className="flex-row items-center justify-between px-4 py-3">
      <Pressable onPress={() => router.back()} className="p-2">
        <ChevronLeft size={24} color="#ffffff" />
      </Pressable>
      <Text className="mr-10 flex-1 text-center text-xl font-bold text-white">Account details</Text>
    </View>
  );

  const desktopHeader = (
    <>
      <Navbar />
      <View className="mx-auto w-full max-w-[512px] px-4 pb-8 pt-8">
        <View className="mb-8 flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
            <ArrowLeft color="white" />
          </Pressable>
          <Text className="text-3xl font-semibold text-white">Account details</Text>
          <View className="w-6" />
        </View>
      </View>
    </>
  );

  const deleteModal = (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showDeleteModal}
      onRequestClose={() => !isDeleting && setShowDeleteModal(false)}
    >
      <View className="flex-1 items-center justify-center bg-black/70 px-4">
        <View className="w-full max-w-sm rounded-3xl bg-[#1c1c1c] p-6">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-white">Delete Account</Text>
            <Pressable onPress={() => !isDeleting && setShowDeleteModal(false)}>
              <X size={24} color="#ffffff" />
            </Pressable>
          </View>

          <Text className="mb-6 text-base text-gray-300">
            Are you sure you want to delete your account? This action cannot be undone and will:
          </Text>

          <View className="mb-6">
            <Text className="mb-2 text-sm text-gray-300">• Remove all your data</Text>
            <Text className="mb-2 text-sm text-gray-300">• Cancel any active cards</Text>
            <Text className="mb-2 text-sm text-gray-300">• Delete your transaction history</Text>
            <Text className="text-sm text-gray-300">• Remove access to your wallet</Text>
          </View>

          <View className="flex-row justify-between">
            <Pressable
              onPress={() => setShowDeleteModal(false)}
              className="mr-2 flex-1 rounded-xl bg-gray-700 py-4"
              disabled={isDeleting}
            >
              <Text className="text-center font-semibold text-white">Cancel</Text>
            </Pressable>

            <Pressable
              onPress={confirmDelete}
              className={cn('ml-2 flex-1 rounded-xl py-4', {
                'bg-red-400': isDeleting,
                'bg-red-600': !isDeleting,
              })}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-center font-semibold text-white">Delete Account</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <PageLayout
      customMobileHeader={mobileHeader}
      customDesktopHeader={desktopHeader}
      useDesktopBreakpoint
      additionalContent={deleteModal}
      scrollable={false}
    >
      <View
        className={cn('mx-auto w-full flex-1 px-4 py-4', {
          'max-w-[512px]': isDesktop,
          'max-w-7xl': !isDesktop,
        })}
      >
        {/* Top Content */}
        <View>
          {/* Email Section - shown for all users who have email */}
          {/* {user?.email && (
            <>
              <Text className="text-white text-base font-bold mb-4">Email</Text>
              <View className="bg-[#1c1c1c] rounded-xl overflow-hidden mb-6">
                <SettingsCard
                  title={user.email}
                  icon={<Mail color="#ffffff" size={22} />}
                  isDesktop={isDesktop}
                  hideIconBackground
                  titleStyle="font-medium"
                />
              </View>
            </>
          )} */}

          {/* User Name Section - shown for legacy users or users with custom username */}
          {user?.username && !user.username.startsWith('user_') && (
            <>
              <Text className="mb-4 text-base font-bold text-white">User Name</Text>
              <View className="mb-6 overflow-hidden rounded-xl bg-[#1c1c1c]">
                <SettingsCard
                  title={user.username}
                  icon={<Image source={AccountDetailsIcon} style={{ width: 22, height: 22 }} />}
                  isDesktop={isDesktop}
                  hideIconBackground
                  titleStyle="font-medium"
                />
              </View>
            </>
          )}

          {/* Fallback for users with neither email nor username (should not happen) */}
          {!user?.email && (!user?.username || user.username.startsWith('user_')) && (
            <>
              <Text className="mb-4 text-base font-bold text-white">Account</Text>
              <View className="mb-6 overflow-hidden rounded-xl bg-[#1c1c1c]">
                <SettingsCard
                  title={getUserDisplayName(user)}
                  icon={<Image source={AccountDetailsIcon} style={{ width: 22, height: 22 }} />}
                  isDesktop={isDesktop}
                  hideIconBackground
                  titleStyle="font-medium"
                />
              </View>
            </>
          )}

          {/* Wallet Address Section */}
          <Text className="mb-4 mt-2 text-base font-bold text-white">Wallet address</Text>
          <View className="overflow-hidden rounded-xl bg-[#1c1c1c]">
            <SettingsCard
              title={eclipseAddress(user?.safeAddress as Address)}
              icon={<WalletIcon color="#ffffff" width={21} height={21} />}
              isDesktop={isDesktop}
              hideIconBackground
              titleStyle="font-medium"
              customAction={
                user?.safeAddress ? (
                  <CopyToClipboard
                    text={user.safeAddress}
                    size={18}
                    iconClassName="text-white/70"
                  />
                ) : null
              }
            />
          </View>
        </View>

        {/* Spacer */}
        <View className="flex-1" />

        {/* Delete Account Section - at bottom */}
        <View className={cn('pb-4', { 'pb-24': !isDesktop })}>
          <Pressable
            onPress={handleDeletePress}
            className="overflow-hidden rounded-xl bg-[#1c1c1c]"
          >
            <SettingsCard
              title="Delete account"
              icon={
                <Image
                  source={AccountDetailsIcon}
                  style={{ width: 22, height: 22, tintColor: '#FF7D7D' }}
                />
              }
              isDesktop={isDesktop}
              customAction={<ChevronRight size={20} />}
              titleStyle="text-[#FF7D7D]"
              hideIconBackground
            />
          </Pressable>
        </View>
      </View>
    </PageLayout>
  );
}
