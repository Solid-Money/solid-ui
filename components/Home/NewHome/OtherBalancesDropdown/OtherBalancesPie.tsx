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
 * strokeDasharray tricks) so both segments render deterministically on every
 * platform.
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
  cardValue: number;
  savingsValue: number;
  cardColor: string;
  savingsColor: string;
}

const fullRing = (color: string) => (
  <Circle cx={CENTER} cy={CENTER} r={RADIUS} stroke={color} strokeWidth={STROKE} fill="none" />
);

/**
 * Small donut showing how much Card vs Savings each contributes to the "other
 * balances" total (real proportions). Falls back to an empty grey ring when
 * there's no balance; draws a single full ring when only one side has a balance.
 */
const OtherBalancesPie = ({
  cardValue,
  savingsValue,
  cardColor,
  savingsColor,
}: OtherBalancesPieProps) => {
  const card = Math.max(cardValue, 0);
  const savings = Math.max(savingsValue, 0);
  const total = card + savings;

  let content: React.ReactNode;
  if (total <= 0) {
    content = fullRing(TRACK_COLOR);
  } else if (card <= 0) {
    content = fullRing(savingsColor);
  } else if (savings <= 0) {
    content = fullRing(cardColor);
  } else {
    const cardFraction = card / total;
    content = (
      <>
        <Path
          d={arcPath(0, cardFraction)}
          stroke={cardColor}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="butt"
        />
        <Path
          d={arcPath(cardFraction, 1 - cardFraction)}
          stroke={savingsColor}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="butt"
        />
      </>
    );
  }

  return (
    <Svg width={SIZE} height={SIZE}>
      {content}
    </Svg>
  );
};

export default OtherBalancesPie;
