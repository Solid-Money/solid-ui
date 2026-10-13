import { Fragment } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Download } from 'lucide-react-native';

import Navbar from '@/components/Navbar';
import PageLayout from '@/components/PageLayout';
import { ProfileSectionLabel } from '@/components/Profile/ProfileRow';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import { formatStatementMonth, useStatements } from '@/hooks/useStatements';
import { StatementMonth } from '@/lib/types';
import { cn, formatUSD } from '@/lib/utils';

/** "In progress · $1,284.50 so far" for the current month, "$1,102.18 spent" for the rest. */
const spendLine = ({ cardSpendUsd, partial }: StatementMonth) => {
  const spend = formatUSD(Number(cardSpendUsd) || 0);
  return partial ? `In progress · ${spend} so far` : `${spend} spent`;
};

const MonthRow = ({
  month,
  isPending,
  onPress,
}: {
  month: StatementMonth;
  isPending: boolean;
  onPress: () => void;
}) => {
  const title = formatStatementMonth(month.month);
  return (
    <Pressable
      onPress={onPress}
      disabled={isPending}
      accessibilityRole="button"
      accessibilityLabel={`Download statement for ${title}`}
      className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70 web:hover:bg-[#242424]"
    >
      <View className="flex-1">
        <Text className="text-base font-semibold text-white">{title}</Text>
        <Text className="mt-0.5 text-sm text-[#8E8E8E]">{spendLine(month)}</Text>
      </View>
      {isPending ? (
        <ActivityIndicator size="small" color="#8E8E8E" />
      ) : (
        <Download size={18} color="#8E8E8E" />
      )}
    </Pressable>
  );
};

/**
 * Settings → Statements (Figma "Statements").
 *
 * One CSV per month with card activity and wallet transactions together —
 * purchases, refunds and top-ups alongside deposits, withdrawals, transfers and
 * Earn. Nothing is stored: each download is built from the records as they stand.
 */
export default function Statements() {
  const { isDesktop } = useDimension();
  const { hasStatements, months, isLoading, isError, pendingMonth, download } = useStatements();

  const handleDownload = async (month: string) => {
    if (pendingMonth) return;
    try {
      const result = await download(month);
      // iOS hands the file to the share sheet, which says what happened itself.
      if (result === 'saved') {
        Toast.show({
          type: 'success',
          text1: 'Statement saved',
          text2: formatStatementMonth(month),
        });
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Couldn’t download your statement',
        text2: 'Please try again in a moment.',
      });
    }
  };

  const mobileHeader = (
    <View className="flex-row items-center justify-between px-4 py-3">
      <BackButton variant="header" fallbackHref={path.SETTINGS as string} />
      <Text className="mr-[50px] flex-1 text-center text-xl font-bold text-white">Statements</Text>
    </View>
  );

  const desktopHeader = (
    <>
      <Navbar />
      <View className="mx-auto w-full max-w-[512px] px-4 pb-8 pt-8">
        <View className="mb-8 flex-row items-center justify-between">
          <BackButton />
          <Text className="text-3xl font-semibold text-white">Statements</Text>
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
    >
      <View
        className={cn('mx-auto w-full px-4 pb-32 pt-2', {
          'max-w-[512px]': isDesktop,
          'max-w-7xl': !isDesktop,
        })}
      >
        <Text className="px-1 text-sm leading-5 text-[#8E8E8E]">
          Every card purchase, refund and top-up for the month, together with all wallet activity —
          deposits, withdrawals, transfers and Earn.
        </Text>

        <ProfileSectionLabel>Monthly statements</ProfileSectionLabel>
        {/* The Settings row only shows for whitelisted users; this covers a deep link. */}
        {!hasStatements ? (
          <Text className="mt-2 px-1 text-sm text-[#8E8E8E]">
            Statements aren&apos;t available on your account yet.
          </Text>
        ) : isLoading ? (
          <ActivityIndicator className="mt-8" size="small" color="#8E8E8E" />
        ) : isError ? (
          <Text className="mt-2 px-1 text-sm text-[#8E8E8E]">
            Couldn&apos;t load your statements. Try again later.
          </Text>
        ) : (
          <View className="overflow-hidden rounded-2xl bg-[#1C1C1C]">
            {months.map((month, index) => (
              <Fragment key={month.month}>
                {index > 0 ? <View className="h-px bg-white/10" /> : null}
                <MonthRow
                  month={month}
                  isPending={pendingMonth === month.month}
                  onPress={() => void handleDownload(month.month)}
                />
              </Fragment>
            ))}
          </View>
        )}

        <Text className="mt-3 px-1 text-sm leading-5 text-[#8E8E8E]">
          Tap a month to download or share it as a CSV, for spreadsheets and tax tools.
          {Platform.OS === 'android' ? ' You’ll choose a folder to save it to.' : ''}
        </Text>
      </View>
    </PageLayout>
  );
}
