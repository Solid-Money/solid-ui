import { type ReactNode, useId } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

/**
 * Chromium is currently the only engine that honours an SVG filter inside
 * `backdrop-filter`. This has to be a feature test rather than a fallback
 * declaration: an engine that rejects `url()` throws out the whole property,
 * taking the blur and saturation with it, so the refraction is only ever added
 * where it is known to parse.
 */
const SUPPORTS_BACKDROP_REFRACTION =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('backdrop-filter', 'url(#glass)');

const BASE_BACKDROP = 'blur(10px) saturate(180%)';

interface GlassSurfaceProps {
  /** Matches the surface's own corner radius so the blur clips cleanly. */
  radius: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

/**
 * Web build of the liquid-glass surface.
 *
 * `backdrop-filter` has no function that displaces pixels, so the refraction
 * comes from an SVG filter referenced by `url()`: fractal noise, softened, then
 * driving a displacement map over the backdrop. Only engines that prove they
 * parse it get the refraction (see SUPPORTS_BACKDROP_REFRACTION); the rest keep
 * the blur and saturation alone.
 *
 * The rim is deliberately not part of the filter chain: at 26–52px the inset
 * highlights read as the edge of a thick pane far more clearly than any
 * displacement at this scale does.
 */
export const GlassSurface = ({ radius, children, style, className }: GlassSurfaceProps) => {
  // useId is unique per instance but contains colons, which url(#…) will not parse.
  const filterId = `glass-${useId().replace(/:/g, '')}`;

  return (
    <>
      {SUPPORTS_BACKDROP_REFRACTION && (
        <svg aria-hidden="true" width={0} height={0} style={{ position: 'absolute' }}>
          <defs>
            <filter id={filterId} colorInterpolationFilters="sRGB">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.012 0.016"
                numOctaves={2}
                seed={7}
                result="noise"
              />
              <feGaussianBlur in="noise" stdDeviation={1.6} result="softNoise" />
              <feDisplacementMap
                in="SourceGraphic"
                in2="softNoise"
                scale={16}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
      )}

      <View
        className={className}
        style={[
          {
            borderRadius: radius,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.18)',
            overflow: 'hidden',
            // Lit from the top-left, so the pane reads as having thickness.
            boxShadow: `inset 1px 1px 1px rgba(255, 255, 255, 0.45),
                        inset -1px -1px 1px rgba(255, 255, 255, 0.10),
                        0 4px 14px rgba(0, 0, 0, 0.30)`,
            backgroundImage:
              'linear-gradient(150deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05))',
            backdropFilter: SUPPORTS_BACKDROP_REFRACTION
              ? `${BASE_BACKDROP} url(#${filterId})`
              : BASE_BACKDROP,
            WebkitBackdropFilter: BASE_BACKDROP,
          } as ViewStyle,
          style,
        ]}
      >
        {children}
      </View>
    </>
  );
};
