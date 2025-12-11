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
import { cn, eclipseAddress } from '@/lib/utils';
import { Address } from 'viem';

const AccountDetailsIcon = require('@/assets/images/settings_account_details.png');

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
      <Text className="text-white text-xl font-bold flex-1 text-center mr-10">Account details</Text>
    </View>
  );

  const desktopHeader = (
    <>
      <Navbar />
      <View className="max-w-[512px] mx-auto w-full px-4 pt-8 pb-8">
        <View className="flex-row items-center justify-between mb-8">
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
      <View className="flex-1 bg-black/70 justify-center items-center px-4">
        <View className="bg-[#1c1c1c] rounded-3xl p-6 w-full max-w-sm">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-white text-xl font-bold">Delete Account</Text>
            <Pressable onPress={() => !isDeleting && setShowDeleteModal(false)}>
              <X size={24} color="#ffffff" />
            </Pressable>
          </View>

          <Text className="text-gray-300 text-base mb-6">
            Are you sure you want to delete your account? This action cannot be undone and will:
          </Text>

          <View className="mb-6">
            <Text className="text-gray-300 text-sm mb-2">• Remove all your data</Text>
            <Text className="text-gray-300 text-sm mb-2">• Cancel any active cards</Text>
            <Text className="text-gray-300 text-sm mb-2">• Delete your transaction history</Text>
            <Text className="text-gray-300 text-sm">• Remove access to your wallet</Text>
          </View>

          <View className="flex-row justify-between">
            <Pressable
              onPress={() => setShowDeleteModal(false)}
              className="flex-1 mr-2 bg-gray-700 rounded-xl py-4"
              disabled={isDeleting}
            >
              <Text className="text-white text-center font-semibold">Cancel</Text>
            </Pressable>

            <Pressable
              onPress={confirmDelete}
              className={cn('flex-1 ml-2 rounded-xl py-4', {
                'bg-red-400': isDeleting,
                'bg-red-600': !isDeleting,
              })}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white text-center font-semibold">Delete Account</Text>
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
        className={cn('w-full mx-auto px-4 py-4 flex-1', {
          'max-w-[512px]': isDesktop,
          'max-w-7xl': !isDesktop,
        })}
      >
        {/* Top Content */}
        <View>
          {/* User Name Section */}
          <Text className="text-white text-base font-bold mb-4">User Name</Text>
          <View className="bg-[#1c1c1c] rounded-xl overflow-hidden mb-6">
            <SettingsCard
              title={user?.username || 'Unknown'}
              icon={<Image source={AccountDetailsIcon} style={{ width: 22, height: 22 }} />}
              isDesktop={isDesktop}
              hideIconBackground
              titleStyle="font-medium"
            />
          </View>

          {/* Wallet Address Section */}
          <Text className="text-white text-base font-bold mt-2 mb-4">Wallet address</Text>
          <View className="bg-[#1c1c1c] rounded-xl overflow-hidden">
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
            className="bg-[#1c1c1c] rounded-xl overflow-hidden"
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
