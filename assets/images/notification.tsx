import * as React from "react"
import Svg, { Path, Circle, SvgProps } from "react-native-svg"

export default function Notification(props: SvgProps) {
  return (
    <Svg
      width={97}
      height={89}
      fill="none"
      viewBox="0 0 97 89"
      {...props}
    >
      <Path
        stroke="#fff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.7}
        strokeWidth={2}
        d="M86.217 73.082h-66.77l10.587-53.245a23.4 23.4 0 018.043-13.541A23.07 23.07 0 0152.831 1a23.07 23.07 0 0114.755 5.296 23.4 23.4 0 018.043 13.541z"
        clipRule="evenodd"
      />
      <Path
        stroke="#fff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.7}
        strokeWidth={2}
        d="M9.906 73.081h85.848m-28.615 0c0 3.824-1.508 7.49-4.191 10.194a14.25 14.25 0 01-10.117 4.223 14.25 14.25 0 01-10.118-4.223 14.47 14.47 0 01-4.19-10.194"
      />
      <Circle
        cx={22.165}
        cy={30.165}
        r={21.165}
        fill="#111"
        stroke="#b7b7b7"
        strokeWidth={2}
      />
      <Path
        fill="#fff"
        fillOpacity={0.7}
        d="M22.161 40.665v-16.8h-5.01v-1.38h.78q2.22 0 3.15-.93.96-.96 1.08-2.52h1.77v21.63z"
      />
    </Svg>
  )
}
