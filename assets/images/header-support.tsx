import Svg, { Path, type SvgProps } from 'react-native-svg';

/**
 * Chat-conversation glyph for the header's support button (Figma 24781:8073).
 */
const HeaderSupportIcon = (props: SvgProps) => (
  <Svg width={21.5} height={19.2778} viewBox="0 0 21.5 19.2778" fill="none" {...props}>
    <Path
      d="M15.1944 5.19444H19.6389C20.2526 5.19444 20.75 5.69191 20.75 6.30556V18.5278L17.0467 15.4511C16.8472 15.2853 16.5953 15.1944 16.3359 15.1944H7.41667C6.80301 15.1944 6.30556 14.697 6.30556 14.0833V10.75M15.1944 5.19444V1.86111C15.1944 1.24747 14.697 0.75 14.0833 0.75H1.86111C1.24747 0.75 0.75 1.24747 0.75 1.86111V14.0837L4.45334 11.0064C4.65283 10.8408 4.90471 10.75 5.16407 10.75H6.30556M15.1944 5.19444V9.63889C15.1944 10.2526 14.697 10.75 14.0833 10.75H6.30556"
      stroke="#FFFFFF"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default HeaderSupportIcon;
