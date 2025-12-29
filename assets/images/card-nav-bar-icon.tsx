import * as React from 'react';
import Svg, { ClipPath, Defs, G, Path, Rect, SvgProps } from 'react-native-svg';

interface CardNavBarIconProps extends SvgProps {
  isActive?: boolean;
}

const SvgComponent = ({ color = 'rgba(255, 255, 255, 0.5)', isActive, ...props }: CardNavBarIconProps) => {
  // Override color to white when active (tab bar may pass inactive color due to route mismatch)
  const effectiveColor = isActive ? 'white' : color;

  return (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}>
      <G clipPath="url(#clip0_8915_1146)">
        <Path d="M1.50903 12.0001C1.50903 8.0441 1.50903 6.06611 2.738 4.83712C3.96698 3.60815 5.94498 3.60815 9.90099 3.60815H14.097C18.0529 3.60815 20.031 3.60815 21.2599 4.83712C22.4889 6.06611 22.4889 8.0441 22.4889 12.0001C22.4889 15.9561 22.4889 17.9342 21.2599 19.1631C20.031 20.3921 18.0529 20.3921 14.097 20.3921H9.90099C5.94498 20.3921 3.96698 20.3921 2.738 19.1631C1.50903 17.9342 1.50903 15.9561 1.50903 12.0001Z" stroke={effectiveColor} strokeWidth="2" />
        <Path d="M1.50903 9.9021H22.4889" stroke={effectiveColor} strokeWidth="2" strokeLinecap="round" />
        <Path d="M21.2347 10.1633H2.71269C2.10668 10.1633 1.63996 10.698 1.72187 11.2985L2.7305 18.6925C2.79809 19.188 3.22127 19.5574 3.72132 19.5574H20.7664C21.2941 19.5574 21.731 19.1473 21.7644 18.6206L22.2327 11.2265C22.2692 10.6505 21.8119 10.1633 21.2347 10.1633Z" fill={isActive ? effectiveColor : 'transparent'} />
      </G>
    <Defs>
      <ClipPath id="clip0_8915_1146">
        <Rect width="24" height="24" fill={color} />
      </ClipPath>
    </Defs>
  </Svg>
  );
};

export default SvgComponent;
