import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

export type SavingsHelpGlowColor = 'purple' | 'green';

const GLOW_STOPS: Record<SavingsHelpGlowColor, { start: string; mid: string }> = {
  purple: { start: '#7B5BC9', mid: '#493578' },
  green: { start: '#66D989', mid: '#356B49' },
};

interface SavingsHelpGlowProps {
  color: SavingsHelpGlowColor;
}

/**
 * Soft radial ellipse glow behind each "How savings works" hero illustration
 * (Figma "Purple/Green visual glow" — a single radial-gradient ellipse).
 */
const SavingsHelpGlow = ({ color }: SavingsHelpGlowProps) => {
  const { start, mid } = GLOW_STOPS[color];

  return (
    <Svg viewBox="0 0 200 240" width="100%" height="100%">
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={start} stopOpacity={0.32} />
          <Stop offset="0.55" stopColor={mid} stopOpacity={0.12} />
          <Stop offset="1" stopColor={mid} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={100} cy={120} rx={100} ry={120} fill="url(#glow)" />
    </Svg>
  );
};

export default SavingsHelpGlow;
