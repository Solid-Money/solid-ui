import NumberFlow, { continuous } from '@number-flow/react';

import { cn, formatNumber } from '@/lib/utils';

type ClassNames = {
  wrapper?: string;
  decimalSeparator?: string;
};

type Styles = {
  // Web styling is via className and ::part; keep types aligned with native
  wholeText?: any;
  decimalText?: any;
  suffixText?: any;
};

interface CountUpProps {
  count: number;
  decimalPlaces?: number;
  classNames?: ClassNames;
  styles?: Styles;
  isTrailingZero?: boolean;
  prefix?: string;
  suffix?: string;
}

const CountUp = ({
  count,
  decimalPlaces = 6,
  classNames,
  isTrailingZero = true,
  prefix,
  styles,
  suffix,
}: CountUpProps) => {
  const safeCount = isFinite(count) && count >= 0 ? count : 0;
  const decimalString = safeCount.toFixed(decimalPlaces);
  const maxFractions = formatNumber(safeCount, decimalPlaces);
  const trailingZero = isTrailingZero ? decimalString.split('.')[1] : maxFractions.split('.')[1];

  return (
    <div className={cn('flex items-baseline', classNames?.wrapper)}>
      {prefix ? (
        <span className={classNames?.decimalSeparator} style={styles?.wholeText as any}>
          {prefix}
        </span>
      ) : null}
      <NumberFlow
        value={Math.floor(safeCount)}
        plugins={[continuous]}
        className={cn('font-variant-numeric-tabular', classNames?.decimalSeparator)}
        style={styles?.wholeText as any}
      />
      <span className={classNames?.decimalSeparator} style={styles?.decimalText as any}>
        .
      </span>
      <NumberFlow
        value={Number(trailingZero ?? '0')}
        plugins={[continuous]}
        // Render exact decimals without grouping
        format={{
          useGrouping: false,
          minimumIntegerDigits: decimalPlaces,
          maximumFractionDigits: 0,
        }}
        className={cn('font-variant-numeric-tabular', classNames?.decimalSeparator)}
        style={styles?.decimalText as any}
      />
      {suffix ? (
        <span
          className={classNames?.decimalSeparator}
          style={{ marginLeft: 6, ...(styles?.wholeText as any), ...(styles?.suffixText as any) }}
        >
          {suffix}
        </span>
      ) : null}
    </div>
  );
};

export default CountUp;
