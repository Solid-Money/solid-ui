import Svg, { Circle, Path } from 'react-native-svg';

export type ArcSegment = { key: string; value: number; color: string };

type SegmentedArcProps = {
  segments: ArcSegment[];
  /** Outer width of the arc, stroke included. */
  size: number;
  strokeWidth: number;
  /** Visible gap between segments, in px. */
  gap?: number;
  /** `half` is the gauge over the summary card; `full` is the Insights ring. */
  variant: 'half' | 'full';
  /** Drawn alone when there is nothing to show yet. */
  trackColor?: string;
};

const point = (cx: number, cy: number, r: number, angle: number) =>
  `${(cx + r * Math.cos(angle)).toFixed(2)} ${(cy + r * Math.sin(angle)).toFixed(2)}`;

const arcPath = (cx: number, cy: number, r: number, from: number, to: number) =>
  `M ${point(cx, cy, r, from)} A ${r} ${r} 0 ${to - from > Math.PI ? 1 : 0} 1 ${point(cx, cy, r, to)}`;

/**
 * Category share as a thin arc of rounded segments with gaps between them —
 * the style of the leading money apps, rather than a flat pie.
 *
 * Round caps extend each segment by half the stroke at both ends, so the caps
 * are taken out of the angle a segment is given; a sliver too small for its
 * caps still renders, as a dot.
 */
export default function SegmentedArc({
  segments,
  size,
  strokeWidth,
  gap = 5,
  variant,
  trackColor = '#2A2A2A',
}: SegmentedArcProps) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = r + strokeWidth / 2;
  const height = variant === 'half' ? r + strokeWidth + 2 : size;

  const visible = segments.filter(segment => segment.value > 0);
  const total = visible.reduce((sum, segment) => sum + segment.value, 0);

  if (total <= 0) {
    return (
      <Svg width={size} height={height}>
        {variant === 'full' ? (
          <Circle cx={cx} cy={cy} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        ) : (
          <Path
            d={arcPath(cx, cy, r, Math.PI, Math.PI * 2)}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
        )}
      </Svg>
    );
  }

  const capAngle = strokeWidth / 2 / r;
  const gapAngle = gap / r;
  const separators = variant === 'full' ? visible.length : visible.length - 1;
  const sweep = variant === 'full' ? Math.PI * 2 : Math.PI - 2 * capAngle;
  const available = Math.max(0, sweep - separators * (2 * capAngle + gapAngle));

  const start = variant === 'full' ? -Math.PI / 2 + capAngle + gapAngle / 2 : Math.PI + capAngle;
  // Each segment's start and length, laid end to end with a cap and a gap between.
  const arcs = visible.reduce<{ segment: ArcSegment; from: number; length: number }[]>(
    (acc, segment) => {
      const previous = acc[acc.length - 1];
      const from = previous ? previous.from + previous.length + 2 * capAngle + gapAngle : start;
      const length = Math.max(0.002, (segment.value / total) * available);
      return [...acc, { segment, from, length }];
    },
    [],
  );

  return (
    <Svg width={size} height={height}>
      {arcs.map(({ segment, from, length }) => {
        // A lone segment closes the full ring; a zero-length path would not.
        if (variant === 'full' && arcs.length === 1) {
          return (
            <Circle
              key={segment.key}
              cx={cx}
              cy={cy}
              r={r}
              stroke={segment.color}
              strokeWidth={strokeWidth}
              fill="none"
            />
          );
        }
        return (
          <Path
            key={segment.key}
            d={arcPath(cx, cy, r, from, from + length)}
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
        );
      })}
    </Svg>
  );
}
