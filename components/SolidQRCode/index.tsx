import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, Rect } from 'react-native-svg';
import { Image } from 'expo-image';
import qrcode from 'qrcode-generator';

const solidLogoSource = require('@/assets/images/solid-logo-4x.png');

type SolidQRCodeProps = {
  value: string;
  size?: number;
  backgroundColor?: string;
  foregroundColor?: string;
  quietZone?: number;
  dotRadius?: number;
  showLogo?: boolean;
  logoSizeRatio?: number;
};

type FinderPatternProps = {
  x: number;
  y: number;
  cellSize: number;
  color: string;
  bgColor: string;
  radius: number;
};

const FINDER_SIZE = 7;

const FinderPattern = ({ x, y, cellSize, color, bgColor, radius }: FinderPatternProps) => {
  const outerSize = FINDER_SIZE * cellSize;
  const middleOffset = cellSize;
  const middleSize = 5 * cellSize;
  const innerOffset = 2 * cellSize;
  const innerSize = 3 * cellSize;

  const outerR = radius * 2.5;
  const middleR = radius * 1.8;
  const innerR = radius * 1.2;

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
  backgroundColor = '#1A1A2E',
  foregroundColor = '#FFFFFF',
  quietZone = 2,
  dotRadius = 0.4,
  showLogo = true,
  logoSizeRatio = 0.22,
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
  const radius = cellSize * dotRadius;

  const logoPixelSize = size * logoSizeRatio;
  const logoClearModules = Math.ceil(logoPixelSize / cellSize / 2) + 1;
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
      return (
        Math.abs(row - center + 0.5) < logoClearModules &&
        Math.abs(col - center + 0.5) < logoClearModules
      );
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

        const x = (col + quietZone) * cellSize;
        const y = (row + quietZone) * cellSize;
        dots.push(
          <Rect
            key={`${row}-${col}`}
            x={x}
            y={y}
            width={cellSize}
            height={cellSize}
            rx={radius}
            ry={radius}
            fill={foregroundColor}
          />,
        );
      }
    }
    return dots;
  }, [
    modules,
    moduleCount,
    cellSize,
    quietZone,
    radius,
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
        radius={radius}
      />
    ));
  }, [moduleCount, cellSize, quietZone, foregroundColor, backgroundColor, radius]);

  const logoContainerSize = logoPixelSize + 8;

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <ClipPath id="qr-clip">
            <Rect x={0} y={0} width={size} height={size} rx={16} ry={16} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#qr-clip)">
          <Rect x={0} y={0} width={size} height={size} fill={backgroundColor} />
          {finderPatterns}
          {dataDots}
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
            borderRadius: logoContainerSize / 2,
            backgroundColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={solidLogoSource}
            style={{ width: logoPixelSize * 0.65, height: logoPixelSize * 0.65 }}
            contentFit="contain"
          />
        </View>
      )}
    </View>
  );
};

export default SolidQRCode;
