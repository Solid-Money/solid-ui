import { Href, router } from 'expo-router';
import { ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DeleteAccountIcon from '@/assets/images/delete-account';
import EmailIcon from '@/assets/images/email';
import UsernameIcon from '@/assets/images/username';
import WalletIcon from '@/assets/images/wallet';
import CopyToClipboard from '@/components/CopyToClipboard';
import Navbar from '@/components/Navbar';
import { SettingsCard } from '@/components/Settings';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { cn, eclipseAddress } from '@/lib/utils';
import { Address } from 'viem';

interface Detail {
  title: string;
  description?: string | Address;
  isAddress?: boolean;
  icon?: React.ReactNode;
  link?: Href;
}

export default function Account() {
  const { user, handleDeleteAccount } = useUser();
  const { isDesktop } = useDimension();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const details: Detail[] = [
    {
      title: 'User Name',
      description: user?.username,
      icon: <UsernameIcon color="#ffffff" />,
    },
    {
      title: 'Wallet Address',
      description: user?.safeAddress,
      isAddress: true,
      icon: <WalletIcon color="#ffffff" />,
    },
    {
      title: 'Email',
      description: user?.email,
      icon: <EmailIcon color="#ffffff" />,
      link: '/settings/email',
    },
  ];

  const handleDeletePress = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await handleDeleteAccount();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <>
      <SafeAreaView
        className="bg-black text-foreground flex-1"
        edges={['right', 'left', 'bottom', 'top']}
      >
        <ScrollView className="flex-1">
          {/* Desktop Navbar */}
          {isDesktop && <Navbar />}

          {/* Header */}
          {isDesktop ? (
            <View className="max-w-[512px] mx-auto w-full px-4 pt-8 pb-8">
              <View className="flex-row items-center justify-between mb-8">
                <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
                  <ArrowLeft color="white" />
                </Pressable>
                <Text className="text-3xl font-semibold text-white">Account details</Text>
                <View className="w-6" />
              </View>
            </View>
          ) : (
            <View className="flex-row items-center justify-between px-4 py-3">
              <Pressable onPress={() => router.back()} className="p-2">
                <ChevronLeft size={24} color="#ffffff" />
              </Pressable>
              <Text className="text-white text-xl font-bold flex-1 text-center mr-10">
                Account details
              </Text>
            </View>
          )}

          <View
            className={cn('w-full mx-auto gap-3 px-4 py-4', {
              'max-w-[512px]': isDesktop,
              'max-w-7xl': !isDesktop,
            })}
          >
            <View className="bg-[#1c1c1c] rounded-xl overflow-hidden">
              {details.map((detail, index) => (
                <SettingsCard
                  key={`detail-${index}`}
                  title={detail.title}
                  description={
                    detail.isAddress
                      ? eclipseAddress(detail.description as Address)
                      : detail.description
                  }
                  icon={detail.icon}
                  link={detail.link}
                  isDesktop={isDesktop}
                  inlineAction={
                    detail.isAddress && user?.safeAddress ? (
                      <CopyToClipboard text={user.safeAddress} />
                    ) : null
                  }
                  customAction={detail.link ? <ChevronRight size={20} color="#ffffff" /> : null}
                />
              ))}
            </View>

            {/* Delete Account Section */}
            <View className="mt-4">
              <Pressable
                onPress={handleDeletePress}
                className="bg-[#1c1c1c] rounded-xl overflow-hidden"
              >
                <SettingsCard
                  title="Delete account"
                  icon={<DeleteAccountIcon />}
                  isDesktop={isDesktop}
                  customAction={<ChevronRight size={20} color="#ff7d7d" />}
                  titleStyle="text-[#ff7d7d]"
                  hideIconBackground={true}
                />
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Delete Account Modal */}
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
    </>
  );
}
