import { DimensionValue, ImageSourcePropType, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { VaultBreakdown } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';

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
}

interface HeaderProps {
  columns: Column[];
}

interface BodyProps {
  columns: Column[];
  data: VaultBreakdown[];
  setSelectedBreakdown: (index: number) => void;
}

const images: Record<string, ImageSourcePropType> = {
  Pendle: require('@/assets/images/pendle.png'),
};

const columns: Column[] = [
  {
    title: 'Destinations',
    key: 'type',
    width: '25%',
  },
  {
    key: 'chain',
    width: '20%',
    classNames: {
      body: {
        text: 'text-muted-foreground',
      },
    },
  },
  {
    title: 'Allocation',
    key: 'allocation',
    width: '15%',
    percent: true,
  },
  {
    title: 'Risk',
    key: 'risk',
    width: '15%',
  },
  {
    title: '7D',
    key: 'effectivePositionAPY',
    width: '15%',
    percent: true,
  },
  {
    width: '10%',
  },
];

const Header = ({ columns }: HeaderProps) => {
  return (
    <View className="flex-row border-b border-border pb-2">
      {columns.map((c, index) => (
        <View key={`vault-th-${index}`} style={{ width: c.width }}>
          <Text className="text-muted-foreground font-medium">{c.title}</Text>
        </View>
      ))}
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
          {columns.map((c, index) => (
            <View key={`vault-tb-${index}`} style={{ width: c.width }}>
              {c.key ? (
                <View className="flex-row items-center gap-2">
                  {c.key === 'type' && (
                    <Image
                      source={images[d[c.key]]}
                      style={{ width: 24, height: 24 }}
                      contentFit="contain"
                    />
                  )}
                  <Text className={cn('text-lg font-medium', c.classNames?.body?.text)}>
                    {c.percent ? `${formatNumber(Number(d[c.key]), 2)}%` : d[c.key]}
                  </Text>
                </View>
              ) : (
                <ChevronRight color="white" />
              )}
            </View>
          ))}
        </Pressable>
      ))}
    </View>
  );
};

const VaultBreakdownTable = ({ data, setSelectedBreakdown }: TableProps) => {
  return (
    <View className="flex-1">
      <Header columns={columns} />
      <Body data={data} columns={columns} setSelectedBreakdown={setSelectedBreakdown} />
    </View>
  );
};

export default VaultBreakdownTable;
