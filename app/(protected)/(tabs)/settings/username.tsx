import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import Checkmark from '@/assets/images/checkmark';
import InfoError from '@/assets/images/info-error';
import Navbar from '@/components/Navbar';
import PageLayout from '@/components/PageLayout';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import { useUsernameAvailability } from '@/hooks/useUsernameAvailability';
import { track } from '@/lib/analytics';
import { updateUsername } from '@/lib/api';
import { User } from '@/lib/types';
import { cn, withRefreshToken } from '@/lib/utils';
import {
  getUsernameFormatError,
  normalizeUsername,
  sanitizeUsernameInput,
  USERNAME_MAX_LENGTH,
} from '@/lib/utils/username';
import { useUserStore } from '@/store/useUserStore';

// Long enough to read the confirmation, short enough not to feel stuck.
const SUCCESS_DISMISS_MS = 1500;

export default function Username() {
  const router = useRouter();
  const { isDesktop } = useDimension();
  const insets = useSafeAreaInsets();
  const { user, updateStoredUser } = useUserStore(
    useShallow(state => ({
      user: state.users.find((u: User) => u.selected),
      updateStoredUser: state.updateUser,
    })),
  );

  const currentUsername = user?.username ?? '';

  const [value, setValue] = useState(currentUsername);
  // Only shown once the user has tried to save, so a half-typed name is not
  // called invalid while they are still typing it.
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedUsername, setSavedUsername] = useState<string | null>(null);
  const hasSeededRef = useRef(false);

  const candidate = normalizeUsername(value);
  const isUnchanged = candidate === currentUsername;
  // Asking about the name the account already holds would come back "taken":
  // the availability endpoint is public and knows nothing about the caller.
  const availability = useUsernameAvailability(value, { skip: isUnchanged });

  // Seed once the persisted user has arrived, and only while the field is
  // still untouched, so a value being typed is never overwritten.
  useEffect(() => {
    if (hasSeededRef.current || !currentUsername) return;
    hasSeededRef.current = true;
    setValue(currentUsername);
  }, [currentUsername]);

  useEffect(() => {
    track(TRACKING_EVENTS.USERNAME_CHANGE_VIEWED);
  }, []);

  // Leave on the confirmation rather than dropping the user back mid-read.
  useEffect(() => {
    if (!savedUsername) return;
    const timer = setTimeout(() => router.back(), SUCCESS_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [savedUsername, router]);

  const handleChange = (text: string) => {
    setValue(sanitizeUsernameInput(text));
    setSubmitError(null);
  };

  const handleSave = useCallback(async () => {
    if (isSubmitting || isUnchanged) return;

    const formatError = getUsernameFormatError(value);
    if (formatError) {
      setSubmitError(formatError);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await withRefreshToken(() => updateUsername(candidate));
      const saved = result?.username || candidate;

      // Keep the local copy in step: the handle is shown on the home screen and
      // sent with analytics, and nothing else refetches the user here.
      if (user) {
        updateStoredUser({ ...user, username: saved });
      }

      track(TRACKING_EVENTS.USERNAME_CHANGED);
      setSavedUsername(saved);
    } catch (error) {
      // The server owns the reserved list and uniqueness, so its reason is the
      // one worth showing — a taken handle in particular.
      const reason =
        (error as { message?: string })?.message ||
        'Could not change your username. Please try again.';
      setSubmitError(reason);
      track(TRACKING_EVENTS.USERNAME_CHANGE_FAILED, { reason });
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, isUnchanged, value, candidate, user, updateStoredUser]);

  const displayError =
    submitError || (availability.status === 'unavailable' ? availability.reason : null);
  const canSave = !isUnchanged && !getUsernameFormatError(value) && !isSubmitting && !displayError;

  const mobileHeader = (
    <View className="flex-row items-center justify-between px-4 py-3">
      <BackButton />
      <Text className="mr-[50px] flex-1 text-center text-xl font-bold text-white">Username</Text>
    </View>
  );

  const desktopHeader = (
    <>
      <Navbar />
      <View className="mx-auto w-full max-w-[512px] px-4 pb-8 pt-8">
        <View className="mb-8 flex-row items-center justify-between">
          <BackButton />
          <Text className="text-3xl font-semibold text-white">Username</Text>
          <View className="w-[50px]" />
        </View>
      </View>
    </>
  );

  const saveButton = (className: string) => (
    <Button variant="brand" className={className} onPress={handleSave} disabled={!canSave}>
      <Text className="text-base font-bold">Save</Text>
      {isSubmitting && <ActivityIndicator color="white" />}
    </Button>
  );

  return (
    <PageLayout
      customMobileHeader={mobileHeader}
      customDesktopHeader={desktopHeader}
      useDesktopBreakpoint
    >
      <View className="flex-1">
        <View
          className={cn('mx-auto w-full px-4 py-4', {
            'max-w-[512px]': isDesktop,
            'max-w-7xl': !isDesktop,
          })}
        >
          {savedUsername ? (
            <View className="flex-1 items-center justify-center py-12">
              <Checkmark width={120} height={120} color="#94F27F" />
              <Text className="mt-6 text-center text-2xl font-semibold text-white">
                Username updated!
              </Text>
              <Text className="mt-2 text-center text-muted-foreground">@{savedUsername}</Text>
            </View>
          ) : (
            <>
              <Text className="mb-8 text-sm font-medium text-muted-foreground">
                This is the name other people see. It has to be unique, and you can change it again
                later.
              </Text>

              <View className="gap-2">
                <Text className="text-muted-foreground">Username</Text>
                <Input
                  id="username"
                  value={value}
                  onChangeText={handleChange}
                  onSubmitEditing={handleSave}
                  placeholder="Your username"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  returnKeyType="done"
                  maxLength={USERNAME_MAX_LENGTH}
                  className="rounded-2xl bg-accent"
                  error={!!displayError}
                  prefix={<Text className="text-lg font-semibold text-white/40">@</Text>}
                />

                {/* One status line: the problem to fix, or confirmation the name is free */}
                {displayError ? (
                  <View className="mt-1 flex-row items-center gap-2">
                    <InfoError />
                    <Text className="flex-1 text-sm text-red-400">{displayError}</Text>
                  </View>
                ) : isUnchanged ? (
                  <Text className="mt-1 text-sm text-muted-foreground">
                    This is your current username
                  </Text>
                ) : availability.status === 'checking' ? (
                  <Text className="mt-1 text-sm text-muted-foreground">Checking availability…</Text>
                ) : availability.status === 'available' ? (
                  <Text className="mt-1 text-sm text-brand">@{candidate} is available</Text>
                ) : null}
              </View>
            </>
          )}

          {/* Desktop button - inline with content */}
          {isDesktop && !savedUsername && (
            <View className="mt-8 gap-3">{saveButton('h-12 w-auto rounded-2xl px-8')}</View>
          )}
        </View>

        {/* Mobile button - at bottom */}
        {!isDesktop && !savedUsername && (
          <View
            className="gap-3 bg-black px-4 pt-4"
            style={{ paddingBottom: insets.bottom + 80 }} // Tab bar height + padding
          >
            {saveButton('h-12 rounded-2xl')}
          </View>
        )}
      </View>
    </PageLayout>
  );
}
