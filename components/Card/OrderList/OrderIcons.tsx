import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

/**
 * The order screens' Figma icons, path data copied from the exported SVGs (file 5c8C0djno8xYoQkUdOh8Ng).
 */

/** Figma "Drag handle" (30971:15192): six dots, white at 40%, in a 20pt square. */
export const DragHandleIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
    <Path
      d="M7.5 5.58333C8.2824 5.58333 8.91667 4.94907 8.91667 4.16667C8.91667 3.38426 8.2824 2.75 7.5 2.75C6.7176 2.75 6.08333 3.38426 6.08333 4.16667C6.08333 4.94907 6.7176 5.58333 7.5 5.58333Z"
      fill="white"
      fillOpacity={0.4}
    />
    <Path
      d="M7.5 11.4167C8.2824 11.4167 8.91667 10.7824 8.91667 10C8.91667 9.2176 8.2824 8.58333 7.5 8.58333C6.7176 8.58333 6.08333 9.2176 6.08333 10C6.08333 10.7824 6.7176 11.4167 7.5 11.4167Z"
      fill="white"
      fillOpacity={0.4}
    />
    <Path
      d="M7.5 17.25C8.2824 17.25 8.91667 16.6157 8.91667 15.8333C8.91667 15.0509 8.2824 14.4167 7.5 14.4167C6.7176 14.4167 6.08333 15.0509 6.08333 15.8333C6.08333 16.6157 6.7176 17.25 7.5 17.25Z"
      fill="white"
      fillOpacity={0.4}
    />
    <Path
      d="M12.5 5.58333C13.2824 5.58333 13.9167 4.94907 13.9167 4.16667C13.9167 3.38426 13.2824 2.75 12.5 2.75C11.7176 2.75 11.0833 3.38426 11.0833 4.16667C11.0833 4.94907 11.7176 5.58333 12.5 5.58333Z"
      fill="white"
      fillOpacity={0.4}
    />
    <Path
      d="M12.5 11.4167C13.2824 11.4167 13.9167 10.7824 13.9167 10C13.9167 9.2176 13.2824 8.58333 12.5 8.58333C11.7176 8.58333 11.0833 9.2176 11.0833 10C11.0833 10.7824 11.7176 11.4167 12.5 11.4167Z"
      fill="white"
      fillOpacity={0.4}
    />
    <Path
      d="M12.5 17.25C13.2824 17.25 13.9167 16.6157 13.9167 15.8333C13.9167 15.0509 13.2824 14.4167 12.5 14.4167C11.7176 14.4167 11.0833 15.0509 11.0833 15.8333C11.0833 16.6157 11.7176 17.25 12.5 17.25Z"
      fill="white"
      fillOpacity={0.4}
    />
  </Svg>
);

/** Figma "icon/info": a 1.5pt ring with the i, white at 60%, in an 18pt square. */
export const InfoIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
    <G clipPath="url(#order-info-clip)">
      <Path
        d="M16.5 9C16.5 13.1421 13.1421 16.5 9 16.5C4.85786 16.5 1.5 13.1421 1.5 9C1.5 4.85786 4.85786 1.5 9 1.5C13.1421 1.5 16.5 4.85786 16.5 9Z"
        stroke="white"
        strokeOpacity={0.6}
        strokeWidth={1.5}
      />
      <Path
        d="M9 12V9"
        stroke="white"
        strokeOpacity={0.6}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M9 6H9.0075"
        stroke="white"
        strokeOpacity={0.6}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </G>
    <Defs>
      <ClipPath id="order-info-clip">
        <Rect width={18} height={18} fill="white" />
      </ClipPath>
    </Defs>
  </Svg>
);

/** Figma back button: the arrow in a 44pt #2A2A2A circle. */
export const BackCircleIcon = () => (
  <Svg width={44} height={44} viewBox="0 0 44 44" fill="none">
    <Rect width={44} height={44} rx={22} fill="#2A2A2A" />
    <Path
      d="M15 21.7486H29.5293M20.7486 27.4971L15 21.7486L20.7486 16"
      stroke="white"
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);
