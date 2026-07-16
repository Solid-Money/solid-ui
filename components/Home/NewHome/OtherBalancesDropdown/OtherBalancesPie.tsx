import Svg, { Circle, G } from 'react-native-svg';

const SIZE = 20;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface OtherBalancesPieProps {
  cardValue: number;
  savingsValue: number;
  cardColor: string;
  savingsColor: string;
}

/**
 * Small donut that shows how much Card vs Savings each contributes to the
 * "other balances" total (real proportions, not a fixed gradient). Falls back to
 * an empty grey ring when there's no balance.
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

  if (total <= 0) {
    return (
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke="#3A3A3A"
          strokeWidth={STROKE}
          fill="none"
        />
      </Svg>
    );
  }

  const cardFraction = card / total;
  const savingsFraction = savings / total;
  const cardLength = cardFraction * CIRCUMFERENCE;
  const savingsLength = savingsFraction * CIRCUMFERENCE;

  return (
    <Svg width={SIZE} height={SIZE}>
      {/* Rotate so the arcs start at 12 o'clock. */}
      <G rotation={-90} origin={`${CENTER}, ${CENTER}`}>
        {card > 0 && (
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={cardColor}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${cardLength} ${CIRCUMFERENCE}`}
          />
        )}
        {savings > 0 && (
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={savingsColor}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${savingsLength} ${CIRCUMFERENCE}`}
            strokeDashoffset={-cardLength}
          />
        )}
      </G>
    </Svg>
  );
};

export default OtherBalancesPie;
