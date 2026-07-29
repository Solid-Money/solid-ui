import Svg, { Circle, Path } from 'react-native-svg';

const SIZE = 20;
const STROKE = 3;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const TRACK_COLOR = '#3A3A3A';

const point = (angle: number): [number, number] => [
  CENTER + RADIUS * Math.cos(angle),
  CENTER + RADIUS * Math.sin(angle),
];

/**
 * SVG arc for a segment starting at `startFraction` of the circle and spanning
 * `sweepFraction`, measured clockwise from 12 o'clock. Explicit arcs (rather than
 * strokeDasharray tricks) so every segment renders deterministically on all
 * platforms.
 */
const arcPath = (startFraction: number, sweepFraction: number) => {
  const a0 = -Math.PI / 2 + startFraction * 2 * Math.PI;
  const a1 = a0 + sweepFraction * 2 * Math.PI;
  const [x0, y0] = point(a0);
  const [x1, y1] = point(a1);
  const largeArc = sweepFraction > 0.5 ? 1 : 0;
  return `M ${x0} ${y0} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x1} ${y1}`;
};

interface OtherBalancesPieProps {
  walletValue: number;
  cardValue: number;
  savingsValue: number;
  walletColor: string;
  cardColor: string;
  savingsColor: string;
}

const fullRing = (color: string) => (
  <Circle cx={CENTER} cy={CENTER} r={RADIUS} stroke={color} strokeWidth={STROKE} fill="none" />
);

/**
 * Small donut showing how much Wallet (white), Card (green) and Savings (purple)
 * each contribute to the total, in real proportions. Falls back to an empty grey
 * ring when there's no balance; draws a single full ring when only one balance is
 * non-zero.
 */
const OtherBalancesPie = ({
  walletValue,
  cardValue,
  savingsValue,
  walletColor,
  cardColor,
  savingsColor,
}: OtherBalancesPieProps) => {
  const segments = [
    { value: Math.max(walletValue, 0), color: walletColor },
    { value: Math.max(cardValue, 0), color: cardColor },
    { value: Math.max(savingsValue, 0), color: savingsColor },
  ].filter(segment => segment.value > 0);

  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  let content: React.ReactNode;
  if (total <= 0) {
    content = fullRing(TRACK_COLOR);
  } else if (segments.length === 1) {
    content = fullRing(segments[0].color);
  } else {
    let start = 0;
    content = segments.map(segment => {
      const sweep = segment.value / total;
      const path = (
        <Path
          key={segment.color}
          d={arcPath(start, sweep)}
          stroke={segment.color}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="butt"
        />
      );
      start += sweep;
      return path;
    });
  }

  return (
    <Svg width={SIZE} height={SIZE}>
      {content}
    </Svg>
  );
};

export default OtherBalancesPie;
