import Svg, { G, Path } from 'react-native-svg';

/**
 * Icons for the virtual USD account details screen, transcribed verbatim from the
 * Figma exports (file 5c8C0djno8xYoQkUdOh8Ng, node 21445:3186). Each component keeps
 * the exported asset's own width/height/viewBox so its geometry — including the
 * half-stroke overflow Figma bakes into the box — matches the design exactly.
 */

/** Figma 21445:3348 — the copy affordance on each detail row. */
export const CopyFieldIcon = () => (
  <Svg width={19.0251} height={19.0251} viewBox="0 0 19.0251 19.0251" fill="none">
    <Path
      d="M7.63307 4.64446C7.942 1.70288 9.3591 0.75 12.9202 0.75C17.0151 0.75 18.2751 2.00998 18.2751 6.10489C18.2751 9.66598 17.3222 11.0831 14.3806 11.392M0.75 12.9202C0.75 8.82527 2.00998 7.56531 6.10489 7.56531C10.1998 7.56531 11.4598 8.82527 11.4598 12.9202C11.4598 17.0151 10.1998 18.2751 6.10489 18.2751C2.00998 18.2751 0.75 17.0151 0.75 12.9202Z"
      stroke="white"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** Figma 21445:3825 — the "More information" row icon. */
export const InfoRowIcon = () => (
  <Svg width={22.5} height={22.5} viewBox="0 0 22.5 22.5" fill="none">
    <G>
      <Path
        d="M11.25 21.75C17.049 21.75 21.75 17.049 21.75 11.25C21.75 5.45101 17.049 0.75 11.25 0.75C5.45101 0.75 0.75 5.45101 0.75 11.25C0.75 17.049 5.45101 21.75 11.25 21.75Z"
        stroke="white"
        strokeWidth={1.5}
      />
      <Path d="M11.25 16.5V10.2" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
      <Path
        d="M11.25 6C11.8299 6 12.3 6.4701 12.3 7.05C12.3 7.6299 11.8299 8.1 11.25 8.1C10.6701 8.1 10.2 7.6299 10.2 7.05C10.2 6.4701 10.6701 6 11.25 6Z"
        fill="white"
      />
    </G>
  </Svg>
);
