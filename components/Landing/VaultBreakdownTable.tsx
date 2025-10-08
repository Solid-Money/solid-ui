import { DimensionValue, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { VaultBreakdown } from '@/lib/types';
import { cn, eclipseUsername, formatNumber } from '@/lib/utils';
import { protocols, protocolsImages } from '@/constants/protocols';
import { useDimension } from '@/hooks/useDimension';
import TooltipPopover from '@/components/Tooltip';

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
}

const isProtocol = (name: string) => {
  return Object.values(protocols).some(protocol =>
    name.toLowerCase().includes(protocol.toLowerCase()),
  );
};

const formatPercent = (percent: string | number) => {
  return `${formatNumber(Number(percent), 2)}%`;
};

const formatName = (name: string, isScreenMedium: boolean) => {
  const nameLength = {
    max: isScreenMedium ? 25 : 10,
    protocolStart: 2,
  };

  if (isProtocol(name)) {
    const formattedName = name.split('_').slice(nameLength.protocolStart).join('_');
    return eclipseUsername(formattedName, nameLength.max);
  }

  return eclipseUsername(name, nameLength.max);
};

const Header = ({ columns }: HeaderProps) => {
  return (
    <View className="flex-row border-b border-border pb-2">
      {columns.map((c, index) => {
        if (!c.width) return null;

        return (
          <View
            key={`vault-th-${index}`}
            className="flex-row items-center gap-2"
            style={{ width: c.width }}
          >
            <Text className="text-muted-foreground font-medium">{c.title}</Text>
            {c.tooltip && <TooltipPopover text={c.tooltip} />}
          </View>
        );
      })}
    </View>
  );
};

const Body = ({ data, columns, setSelectedBreakdown }: BodyProps) => {
  const { isScreenMedium } = useDimension();

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
                    {c.key === 'name' && (
                      <Image
                        source={protocolsImages[d['type']]}
                        style={{ width: 24, height: 24 }}
                        contentFit="contain"
                      />
                    )}
                    <Text className={cn('text-lg font-medium', c.classNames?.body?.text)}>
                      {c.percent
                        ? formatPercent(d[c.key])
                        : c.key === 'name'
                          ? formatName(d[c.key], isScreenMedium)
                          : d[c.key]}
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
      key: 'name',
      width: isScreenMedium ? '50%' : '50%',
    },
    {
      title: 'Allocation',
      key: 'allocation',
      width: isScreenMedium ? '15%' : '25%',
      percent: true,
    },
    {
      title: 'Risk',
      key: 'risk',
      width: isScreenMedium ? '15%' : 0,
    },
    {
      title: 'APY',
      tooltip: 'Effective Position APY',
      key: 'effectivePositionAPY',
      width: isScreenMedium ? '15%' : '25%',
      percent: true,
    },
    {
      width: isScreenMedium ? '5%' : 0,
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
