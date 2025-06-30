import * as React from "react"
import Svg, { Path, SvgProps } from "react-native-svg"

const UserAvatar = (props: SvgProps) => (
  <Svg width="22" height="22" viewBox="0 0 22 22" fill="none" {...props}>
    <Path d="M11 21C16.5228 21 21 16.5228 21 11C21 5.47715 16.5228 1 11 1C5.47715 1 1 5.47715 1 11C1 16.5228 5.47715 21 11 21Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M11 12C12.6569 12 14 10.6569 14 9C14 7.34315 12.6569 6 11 6C9.34315 6 8 7.34315 8 9C8 10.6569 9.34315 12 11 12Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M6 19.662V18C6 17.4696 6.21071 16.9609 6.58579 16.5858C6.96086 16.2107 7.46957 16 8 16H14C14.5304 16 15.0391 16.2107 15.4142 16.5858C15.7893 16.9609 16 17.4696 16 18V19.662" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
)
export default UserAvatar
