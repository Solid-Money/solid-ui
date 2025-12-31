import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';
import { memo, useCallback, useMemo } from 'react';
import { DimensionValue, Pressable, View } from 'react-native';

import TooltipPopover from '@/components/Tooltip';
import { Text } from '@/components/ui/text';
import { protocols, protocolsImages, protocolTypes } from '@/constants/protocols';
import { useDimension } from '@/hooks/useDimension';
import { VaultBreakdown } from '@/lib/types';
import { cn, eclipseUsername, formatNumber } from '@/lib/utils';

type Column = {
  width: DimensionValue;
  title?: string;
  tooltip?: string;
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
  isScreenMedium: boolean;
}

interface RowProps {
  item: VaultBreakdown;
  columns: Column[];
  index: number;
  isLast: boolean;
  onPress: () => void;
  isScreenMedium: boolean;
}

const protocolKeys = Object.keys(protocols).map(p => p.toLowerCase());

const isProtocol = (type: string) => {
  const typeLower = type.toLowerCase();
  return protocolKeys.some(protocol => typeLower.includes(protocol));
};

const formatPercent = (percent: string | number) => `${formatNumber(Number(percent), 2)}%`;

const formatName = (name: string, type: string, isScreenMedium: boolean) => {
  const maxLength = isScreenMedium ? 25 : 10;

  if (isProtocol(type)) {
    const splitStart = type === protocolTypes.AvantisLP ? 1 : 2;
    const formattedName = name.split('_').slice(splitStart).join('_');
    return eclipseUsername(formattedName, maxLength);
  }

  return eclipseUsername(name, maxLength);
};

const Header = memo(function Header({ columns }: HeaderProps) {
  return (
    <View className="flex-row border-b border-border pb-2">
      {columns.map(
        (c, index) =>
          c.width && (
            <View
              key={`vault-th-${index}`}
              className="flex-row items-center gap-2"
              style={{ width: c.width }}
            >
              <Text className="font-medium text-muted-foreground">{c.title}</Text>
              {c.tooltip && <TooltipPopover text={c.tooltip} />}
            </View>
          ),
      )}
    </View>
  );
});

const Row = memo(function Row({ item, columns, isLast, onPress, isScreenMedium }: RowProps) {
  return (
    <Pressable
      className={cn('flex-row py-4 hover:opacity-70', !isLast && 'border-b border-border')}
      onPress={onPress}
    >
      {columns.map(
        (c, colIndex) =>
          c.width && (
            <View key={`vault-tb-${colIndex}`} style={{ width: c.width }}>
              {c.key ? (
                <View className="flex-row items-center gap-2">
                  {c.key === 'name' && (
                    <Image
                      source={protocolsImages[item.type]}
                      style={{ width: 24, height: 24, borderRadius: 999 }}
                      contentFit="contain"
                    />
                  )}
                  <Text className={cn('text-lg font-medium', c.classNames?.body?.text)}>
                    {c.percent
                      ? formatPercent(item[c.key])
                      : c.key === 'name'
                        ? formatName(item[c.key], item.type, isScreenMedium)
                        : item[c.key]}
                  </Text>
                </View>
              ) : (
                <ChevronRight color="white" className="ml-auto" />
              )}
            </View>
          ),
      )}
    </Pressable>
  );
});

const Body = memo(function Body({
  data,
  columns,
  setSelectedBreakdown,
  isScreenMedium,
}: BodyProps) {
  return (
    <View className="flex-1">
      {data.map((item, index) => (
        <Row
          key={item.name}
          item={item}
          columns={columns}
          index={index}
          isLast={index === data.length - 1}
          onPress={() => setSelectedBreakdown(index)}
          isScreenMedium={isScreenMedium}
        />
      ))}
    </View>
  );
});

const VaultBreakdownTable = memo(function VaultBreakdownTable({
  data,
  setSelectedBreakdown,
  className,
}: TableProps) {
  const { isScreenMedium } = useDimension();

  const columns: Column[] = useMemo(
    () => [
      { title: 'Destinations', key: 'name', width: isScreenMedium ? '50%' : '35%' },
      {
        title: 'Allocation',
        key: 'allocation',
        width: isScreenMedium ? '15%' : '20%',
        percent: true,
      },
      { title: 'Risk', key: 'risk', width: isScreenMedium ? '15%' : '20%' },
      {
        title: 'APY',
        tooltip: 'Position APY',
        key: 'positionMaxAPY',
        width: isScreenMedium ? '15%' : '20%',
        percent: true,
      },
      { width: '5%' },
    ],
    [isScreenMedium],
  );

  const handleSelectBreakdown = useCallback(
    (index: number) => setSelectedBreakdown(index),
    [setSelectedBreakdown],
  );

  return (
    <View className={cn('flex-1', className)}>
      <Header columns={columns} />
      <Body
        data={data}
        columns={columns}
        setSelectedBreakdown={handleSelectBreakdown}
        isScreenMedium={isScreenMedium}
      />
    </View>
  );
});

export default VaultBreakdownTable;
