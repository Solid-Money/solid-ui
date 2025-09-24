import { DimensionValue, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { VaultBreakdown } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import { protocolsImages } from '@/constants/protocols';
import { useDimension } from '@/hooks/useDimension';

type Column = {
  width: DimensionValue;
  title?: string;
  key?: keyof VaultBreakdown;
  percent?: boolean;
  classNames?: {
    body?: {
      text?: string;
    };
  };
};

interface TableProps {
  data: VaultBreakdown[];
  setSelectedBreakdown: (index: number) => void;
  className?: string;
}

interface HeaderProps {
  columns: Column[];
}

interface BodyProps {
  columns: Column[];
  data: VaultBreakdown[];
  setSelectedBreakdown: (index: number) => void;
}

const Header = ({ columns }: HeaderProps) => {
  return (
    <View className="flex-row border-b border-border pb-2">
      {columns.map((c, index) => {
        if (!c.width) return null;

        return (
          <View key={`vault-th-${index}`} style={{ width: c.width }}>
            <Text className="text-muted-foreground font-medium">{c.title}</Text>
          </View>
        );
      })}
    </View>
  );
};

const Body = ({ data, columns, setSelectedBreakdown }: BodyProps) => {
  return (
    <View className="flex-1">
      {data.map((d, index) => (
        <Pressable
          key={`vault-row-${index}`}
          className={cn(
            'flex-row py-4 hover:opacity-70',
            index === data.length - 1 ? 'border-b-0' : 'border-b border-border',
          )}
          onPress={() => setSelectedBreakdown(index)}
        >
          {columns.map((c, index) => {
            if (!c.width) return null;

            return (
              <View key={`vault-tb-${index}`} style={{ width: c.width }}>
                {c.key ? (
                  <View className="flex-row items-center gap-2">
                    {c.key === 'type' && (
                      <Image
                        source={protocolsImages[d[c.key]]}
                        style={{ width: 24, height: 24 }}
                        contentFit="contain"
                      />
                    )}
                    <Text className={cn('text-lg font-medium', c.classNames?.body?.text)}>
                      {c.percent ? `${formatNumber(Number(d[c.key]), 2)}%` : d[c.key]}
                    </Text>
                  </View>
                ) : (
                  <ChevronRight color="white" className="ml-auto" />
                )}
              </View>
            );
          })}
        </Pressable>
      ))}
    </View>
  );
};

const VaultBreakdownTable = ({ data, setSelectedBreakdown, className }: TableProps) => {
  const { isScreenMedium } = useDimension();

  const columns: Column[] = [
    {
      title: 'Destinations',
      key: 'type',
      width: isScreenMedium ? '25%' : '40%',
    },
    {
      key: 'chain',
      width: isScreenMedium ? '20%' : 0,
      classNames: {
        body: {
          text: 'text-muted-foreground',
        },
      },
    },
    {
      title: 'Allocation',
      key: 'allocation',
      width: isScreenMedium ? '15%' : '30%',
      percent: true,
    },
    {
      title: 'Risk',
      key: 'risk',
      width: isScreenMedium ? '15%' : 0,
    },
    {
      title: '7D',
      key: 'effectivePositionAPY',
      width: isScreenMedium ? '15%' : '30%',
      percent: true,
    },
    {
      width: isScreenMedium ? '10%' : 0,
    },
  ];

  return (
    <View className={cn('flex-1', className)}>
      <Header columns={columns} />
      <Body data={data} columns={columns} setSelectedBreakdown={setSelectedBreakdown} />
    </View>
  );
};

export default VaultBreakdownTable;
