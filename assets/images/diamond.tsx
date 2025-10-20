import * as React from "react"
import Svg, { ClipPath, Defs, G, Path, SvgProps } from "react-native-svg"

const SvgComponent = (props: SvgProps) => (
  <Svg
    width={12}
    height={12}
    fill="none"
    {...props}
  >
    <G clipPath="url(#a)">
      <Path
        fill="#acacac"
        fillRule="evenodd"
        d="M9.708.9H2.291L0 4.487 6 11.1l6-6.74zm-.651 1.18 1.442 2.176L5.99 9.319 1.495 4.364l1.46-2.285h6.102"
        clipRule="evenodd"
      />
    </G>
    <Defs>
      <ClipPath id="a">
        <Path fill="#fff" d="M0 0h12v12H0z" />
      </ClipPath>
    </Defs>
  </Svg>
)

export default SvgComponent
