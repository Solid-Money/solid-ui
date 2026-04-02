import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Image } from 'expo-image';
import qrcode from 'qrcode-generator';

const solidLogoSource = require('@/assets/images/solid-logo-4x.png');

type SolidQRCodeProps = {
  value: string;
  size?: number;
  backgroundColor?: string;
  foregroundColor?: string;
  quietZone?: number;
  showLogo?: boolean;
  logoSizeRatio?: number;
};

type FinderPatternProps = {
  x: number;
  y: number;
  cellSize: number;
  color: string;
  bgColor: string;
};

const FINDER_SIZE = 7;

const FinderPattern = ({ x, y, cellSize, color, bgColor }: FinderPatternProps) => {
  const outerSize = FINDER_SIZE * cellSize;
  const middleOffset = cellSize;
  const middleSize = 5 * cellSize;
  const innerOffset = 2 * cellSize;
  const innerSize = 3 * cellSize;

  const outerR = cellSize * 1.4;
  const middleR = cellSize * 1.0;
  const innerR = cellSize * 0.8;

  return (
    <G>
      <Rect x={x} y={y} width={outerSize} height={outerSize} rx={outerR} ry={outerR} fill={color} />
      <Rect
        x={x + middleOffset}
        y={y + middleOffset}
        width={middleSize}
        height={middleSize}
        rx={middleR}
        ry={middleR}
        fill={bgColor}
      />
      <Rect
        x={x + innerOffset}
        y={y + innerOffset}
        width={innerSize}
        height={innerSize}
        rx={innerR}
        ry={innerR}
        fill={color}
      />
    </G>
  );
};

const SolidQRCode = ({
  value,
  size = 200,
  backgroundColor = '#181A1A',
  foregroundColor = '#FFFFFF',
  quietZone = 2,
  showLogo = true,
  logoSizeRatio = 0.26,
}: SolidQRCodeProps) => {
  const { modules, moduleCount } = useMemo(() => {
    const qr = qrcode(0, 'H');
    qr.addData(value || '');
    qr.make();

    const count = qr.getModuleCount();
    const grid: boolean[][] = [];
    for (let row = 0; row < count; row++) {
      grid[row] = [];
      for (let col = 0; col < count; col++) {
        grid[row][col] = qr.isDark(row, col);
      }
    }
    return { modules: grid, moduleCount: count };
  }, [value]);

  const totalModules = moduleCount + quietZone * 2;
  const cellSize = size / totalModules;
  const dotRadius = cellSize * 0.48;

  const logoPixelSize = size * logoSizeRatio;
  const logoClearModules = Math.ceil(logoPixelSize / cellSize / 2) + 2;
  const center = moduleCount / 2;

  const isFinderPattern = useCallback(
    (row: number, col: number) => {
      if (row < FINDER_SIZE && col < FINDER_SIZE) return true;
      if (row < FINDER_SIZE && col >= moduleCount - FINDER_SIZE) return true;
      if (row >= moduleCount - FINDER_SIZE && col < FINDER_SIZE) return true;
      return false;
    },
    [moduleCount],
  );

  const isLogoArea = useCallback(
    (row: number, col: number) => {
      if (!showLogo) return false;
      const dx = row - center + 0.5;
      const dy = col - center + 0.5;
      return Math.sqrt(dx * dx + dy * dy) < logoClearModules;
    },
    [showLogo, center, logoClearModules],
  );

  const dataDots = useMemo(() => {
    const dots: React.ReactElement[] = [];
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (!modules[row][col]) continue;
        if (isFinderPattern(row, col)) continue;
        if (isLogoArea(row, col)) continue;

        const cx = (col + quietZone + 0.5) * cellSize;
        const cy = (row + quietZone + 0.5) * cellSize;
        dots.push(
          <Circle key={`${row}-${col}`} cx={cx} cy={cy} r={dotRadius} fill={foregroundColor} />,
        );
      }
    }
    return dots;
  }, [
    modules,
    moduleCount,
    cellSize,
    quietZone,
    dotRadius,
    foregroundColor,
    isFinderPattern,
    isLogoArea,
  ]);

  const finderPatterns = useMemo(() => {
    const patterns = [
      { row: 0, col: 0 },
      { row: 0, col: moduleCount - FINDER_SIZE },
      { row: moduleCount - FINDER_SIZE, col: 0 },
    ];

    return patterns.map(p => (
      <FinderPattern
        key={`fp-${p.row}-${p.col}`}
        x={(p.col + quietZone) * cellSize}
        y={(p.row + quietZone) * cellSize}
        cellSize={cellSize}
        color={foregroundColor}
        bgColor={backgroundColor}
      />
    ));
  }, [moduleCount, cellSize, quietZone, foregroundColor, backgroundColor]);

  const logoContainerSize = logoPixelSize * 1.15;
  const gradientRadius = logoPixelSize * 0.95;

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <ClipPath id="qr-clip">
            <Rect x={0} y={0} width={size} height={size} rx={16} ry={16} />
          </ClipPath>
          {showLogo && (
            <RadialGradient id="logo-fade" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={backgroundColor} stopOpacity="1" />
              <Stop offset="0.7" stopColor={backgroundColor} stopOpacity="1" />
              <Stop offset="1" stopColor={backgroundColor} stopOpacity="0" />
            </RadialGradient>
          )}
        </Defs>
        <G clipPath="url(#qr-clip)">
          <Rect x={0} y={0} width={size} height={size} fill={backgroundColor} />
          {finderPatterns}
          {dataDots}
          {showLogo && (
            <Circle cx={size / 2} cy={size / 2} r={gradientRadius} fill="url(#logo-fade)" />
          )}
        </G>
      </Svg>
      {showLogo && (
        <View
          style={{
            position: 'absolute',
            top: (size - logoContainerSize) / 2,
            left: (size - logoContainerSize) / 2,
            width: logoContainerSize,
            height: logoContainerSize,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={solidLogoSource}
            style={{ width: logoPixelSize * 0.6, height: logoPixelSize * 0.6 }}
            contentFit="contain"
          />
        </View>
      )}
    </View>
  );
};

export default SolidQRCode;
