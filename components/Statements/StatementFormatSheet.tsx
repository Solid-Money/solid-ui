import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight, FileSpreadsheet, FileText } from 'lucide-react-native';

import ResponsiveModal from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formatStatementMonth } from '@/hooks/useStatements';
import { StatementFormat } from '@/lib/types';

const SHEET_MODAL = { name: 'statement-format', number: 1 };
const SHEET_MODAL_CLOSED = { name: 'close', number: 0 };

interface FormatRowProps {
  icon: ReactNode;
  label: string;
  description: string;
  onPress: () => void;
}

const FormatRow = ({ icon, label, description, onPress }: FormatRowProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityHint={description}
    onPress={onPress}
    className="flex-row items-center gap-3 px-4 py-4 web:hover:bg-white/5"
  >
    <View className="h-10 w-10 items-center justify-center rounded-full bg-white/10">{icon}</View>
    <View className="flex-1">
      <Text className="text-base font-medium text-white">{label}</Text>
      <Text className="text-sm text-[#ACACAC]">{description}</Text>
    </View>
    <ChevronRight size={18} color="#ACACAC" />
  </Pressable>
);

interface StatementFormatSheetProps {
  /**
   * The month the sheet is for, `YYYY-MM`. Kept by the caller after closing, so
   * the sheet still has a title while it animates away.
   */
  month: string | null;
  isOpen: boolean;
  onClose: () => void;
  onChoose: (month: string, format: StatementFormat) => void;
}

/**
 * Settings → Statements: the choice of form for one month's statement — a PDF to
 * read, print or share, or a CSV for spreadsheets and tax tools.
 */
const StatementFormatSheet = ({ month, isOpen, onClose, onChoose }: StatementFormatSheetProps) => {
  if (!month) return null;

  return (
    <ResponsiveModal
      currentModal={SHEET_MODAL}
      previousModal={SHEET_MODAL_CLOSED}
      isOpen={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      trigger={null}
      contentKey="statement-format"
      hideHeader
      mobilePresentation="drawer"
      contentClassName="md:max-w-[420px]"
    >
      <View>
        <Text className="pt-2 text-center text-2xl font-semibold text-white">
          {formatStatementMonth(month)}
        </Text>
        <Text className="mt-1 text-center text-sm text-[#ACACAC]">
          Choose how you’d like your statement
        </Text>

        <View className="mt-6 overflow-hidden rounded-2xl bg-[#2B2B2B]">
          <FormatRow
            icon={<FileText size={18} color="#FFFFFF" />}
            label="PDF statement"
            description="To read, print or share"
            onPress={() => onChoose(month, 'pdf')}
          />
          <View style={styles.divider} />
          <FormatRow
            icon={<FileSpreadsheet size={18} color="#FFFFFF" />}
            label="CSV for spreadsheets"
            description="For Excel, Numbers or tax tools"
            onPress={() => onChoose(month, 'csv')}
          />
        </View>

        <Button className="mt-4 h-12 rounded-full bg-[#2A2A2A]" onPress={onClose}>
          <Text className="text-base font-semibold text-white">Cancel</Text>
        </Button>
      </View>
    </ResponsiveModal>
  );
};

const styles = StyleSheet.create({
  divider: { backgroundColor: 'rgba(255, 255, 255, 0.1)', height: 1 },
});

export default StatementFormatSheet;
