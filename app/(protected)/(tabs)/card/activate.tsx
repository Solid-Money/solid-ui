import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCreateKycLink, useCustomer, useKycLink } from '@/hooks/useCustomer';
import { createCard } from '@/lib/api';
import { KycLink, KycStatus, TermsOfServiceStatus } from '@/lib/types';
import { cn, withRefreshToken } from '@/lib/utils';

type Step = {
  title: string;
  description: string;
  completed: boolean;
};

export default function ActivateCard() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    tosStatus?: string;
    kycStatus?: string;
  }>();

  // Store whether tosStatus came from URL params
  const isTosStatusFromParams = !!params.tosStatus;

  // Store whether kycStatus came from URL params
  const isKycStatusFromParams = !!params.kycStatus;

  // Use TanStack Query for customer data
  const { data: customer, refetch: refetchCustomer, isRefetching } = useCustomer();

  // Determine the actual status values to use
  const tosStatus = isTosStatusFromParams
    ? (params.tosStatus as TermsOfServiceStatus)
    : customer?.tosStatus || TermsOfServiceStatus.PENDING;

  const kycStatus =
    customer?.kycStatus === KycStatus.APPROVED
      ? customer.kycStatus
      : isKycStatusFromParams
        ? (params.kycStatus as KycStatus)
        : customer?.kycStatus || KycStatus.NOT_STARTED;

  // Use TanStack Query for KYC link data
  const { data: kycLink } = useKycLink(customer?.kycLinkId);

  // Use mutation for creating KYC links
  const createKycLinkMutation = useCreateKycLink();

  const [cardActivated, setCardActivated] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const emailSchema = z.string().email();

  const validateEmail = (email: string) => {
    return emailSchema.safeParse(email).success;
  };

  const steps: Step[] = [
    {
      title: 'Terms of Service',
      description: 'Agree to Solid Card terms',
      completed:
        tosStatus === TermsOfServiceStatus.APPROVED ||
        kycStatus === KycStatus.UNDER_REVIEW ||
        kycStatus === KycStatus.APPROVED ||
        cardActivated,
    },
    {
      title: 'Know Your Customer',
      description: 'Complete identity verification',
      completed: kycStatus === KycStatus.APPROVED || cardActivated,
    },
    {
      title: 'Activate Card',
      description: 'Activate your Solid card',
      completed: cardActivated,
    },
  ];

  const handleProceedToTos = async () => {
    // Enforce email validation before proceeding
    if (!fullName.trim()) {
      alert('Please enter your full name');
      return;
    }

    if (!email.trim()) {
      alert('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      let kycLinkData: KycLink;

      if (kycLink) {
        kycLinkData = kycLink;
      } else {
        setIsLoading(true);

        kycLinkData = await createKycLinkMutation.mutateAsync({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          redirectUri: getRedirectUrl(),
        });
      }

      router.push({
        pathname: path.CARD_TERMS_OF_SERVICE,
        params: {
          url: kycLinkData.tosLink,
        },
      });
    } catch (error) {
      console.error('Error proceeding to ToS:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedToKyc = async () => {
    try {
      let kycLinkData: KycLink;

      if (kycLink) {
        kycLinkData = kycLink;
      } else {
        kycLinkData = await createKycLinkMutation.mutateAsync({
          fullName,
          email,
          redirectUri: getRedirectUrl(),
        });
      }

      setIsLoading(true);

      router.push({
        pathname: path.KYC,
        params: {
          url: kycLinkData.link,
        },
      });
    } catch (error) {
      console.error('Error proceeding to KYC:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRedirectUrl = () => {
    const baseUrl = process.env.EXPO_PUBLIC_BASE_URL;
    return `${baseUrl}${path.CARD_ACTIVATE}?kycStatus=${KycStatus.UNDER_REVIEW}`;
  };

  const handleActivateCard = async () => {
    try {
      setIsLoading(true);
      console.log('Activating card...');
      const card = await withRefreshToken(() => createCard());

      if (!card) throw new Error('Failed to create card');

      console.log('Card created:', card);

      setCardActivated(true);
      setIsLoading(false);

      // Navigate to successful activation or card details screen
      router.replace(path.CARD_DETAILS);
    } catch (error) {
      console.error('Error activating card:', error);
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    if (steps[0].completed && steps[1].completed && steps[2].completed) {
      return (
        <View className="w-full py-8">
          <Text className="text-lg text-center mb-6 font-medium text-white/70">
            Your card has been successfully activated!
          </Text>
        </View>
      );
    }

    // If TOS not complete, we don't need to show anything here
    // since inputs are already shown above the steps
    if (!steps[0].completed) {
      return null;
    }

    // If TOS complete but KYC not complete
    if (steps[0].completed && !steps[1].completed) {
      return (
        <View className="w-full space-y-4">
          <Text className="text-lg text-center mb-2 font-medium text-white/70">
            You need to complete the KYC verification process
          </Text>
        </View>
      );
    }

    // If KYC is under review
    if (steps[0].completed && kycStatus === KycStatus.UNDER_REVIEW) {
      return (
        <View className="w-full space-y-4">
          <Text className="text-lg text-center mb-2 font-medium text-white/70">
            Your KYC verification is under review.
          </Text>
        </View>
      );
    }

    // If both TOS and KYC are complete but card not activated
    if (steps[0].completed && steps[1].completed && !steps[2].completed) {
      return (
        <View className="w-full py-8">
          <Text className="text-lg text-center mb-6 font-medium text-white/70">
            Your identity verification is complete!
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <View className="flex-1 justify-center items-center p-6 bg-background">
      <View className="w-1/2 mx-auto">
        <Text className="text-[28px] font-bold text-center mb-6">Activate your Solid card</Text>

        {/* Show name/email form above steps if TOS not completed */}
        {!steps[0].completed && (
          <View className="w-full space-y-4 mb-6">
            <TextInput
              placeholder="Full name"
              value={fullName}
              onChangeText={setFullName}
              className="h-14 px-6 rounded-xl border border-border text-lg text-foreground font-semibold placeholder:text-muted-foreground"
            />
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              className="h-14 px-6 rounded-xl border border-border text-lg text-foreground font-semibold placeholder:text-muted-foreground"
              autoCapitalize="none"
            />
          </View>
        )}

        {/* Steps */}
        <View className="w-full space-y-4">
          {steps.map((step, index) => {
            // Determine if step is available (previous steps completed)
            const isAvailable =
              index === 0 ||
              (index === 1 && steps[0].completed) ||
              (index === 2 && steps[0].completed && steps[1].completed);

            return (
              <View
                key={index}
                className={cn(
                  'flex-row items-center justify-between p-4 border rounded-xl',
                  step.completed
                    ? 'border-primary bg-primary/10'
                    : isAvailable
                      ? 'border-border'
                      : 'border-border/30 bg-gray-800/30',
                )}
              >
                <View className="flex-1">
                  <Text
                    className={`text-lg font-semibold ${
                      !isAvailable && !step.completed ? 'text-white/40' : ''
                    }`}
                  >
                    {step.title}
                  </Text>
                  <Text
                    className={`text-sm ${
                      !isAvailable && !step.completed ? 'text-white/30' : 'text-white/70'
                    }`}
                  >
                    {step.description}
                  </Text>
                </View>

                {step.completed ? (
                  <Text className="text-sm font-medium text-primary">Completed</Text>
                ) : index === 1 && kycStatus === KycStatus.UNDER_REVIEW ? (
                  <View className="flex-row items-center space-x-2">
                    <Text className="text-sm font-medium text-yellow-500">Under Review</Text>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onPress={() => refetchCustomer()}
                      disabled={isRefetching}
                    >
                      <Text className="text-xs">↻</Text>
                    </Button>
                  </View>
                ) : (
                  (() => {
                    // Show action button only for steps where previous steps are completed
                    if (index === 0 && !step.completed) {
                      return (
                        <Button
                          size="sm"
                          className="h-8 px-3"
                          onPress={handleProceedToTos}
                          disabled={
                            isLoading ||
                            createKycLinkMutation.isPending ||
                            !fullName ||
                            !email ||
                            !validateEmail(email)
                          }
                        >
                          {isLoading ? (
                            <Text className="text-xs font-medium">Loading...</Text>
                          ) : (
                            <Text className="text-xs font-medium">Start</Text>
                          )}
                        </Button>
                      );
                    } else if (index === 1 && !step.completed && steps[0].completed) {
                      return (
                        <Button
                          size="sm"
                          className="h-8 px-3"
                          onPress={handleProceedToKyc}
                          disabled={isLoading || createKycLinkMutation.isPending}
                        >
                          <Text className="text-xs font-medium">Start</Text>
                        </Button>
                      );
                    } else if (
                      index === 2 &&
                      !step.completed &&
                      steps[0].completed &&
                      steps[1].completed
                    ) {
                      return (
                        <Button
                          size="sm"
                          className="h-8 px-3"
                          onPress={handleActivateCard}
                          disabled={isLoading}
                        >
                          <Text className="text-xs font-medium">Activate</Text>
                        </Button>
                      );
                    } else if (!isAvailable) {
                      return <Text className="text-xs text-white/40">Locked</Text>;
                    }
                    return null;
                  })()
                )}
              </View>
            );
          })}
        </View>

        {/* Dynamic content based on steps - now that we moved inputs above, we can simplify this */}
        <View className="mt-6">{renderStepContent()}</View>
      </View>
    </View>
  );
}
