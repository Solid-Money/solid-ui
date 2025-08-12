import * as React from "react"
import Svg, { Path, SvgProps } from "react-native-svg"
const SvgComponent = (props: SvgProps) => (
  <Svg
    width={24}
    height={25}
    fill="none"
    {...props}
  >
    <Path
      fill="#000"
      fillRule="evenodd"
      d="M3.5 5.89a2 2 0 0 1 2-2H9a2 2 0 0 1 2 2v3.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2v-3.5Zm2-.5H9a.5.5 0 0 1 .5.5v3.5a.5.5 0 0 1-.5.5H5.5a.5.5 0 0 1-.5-.5v-3.5a.5.5 0 0 1 .5-.5Zm-2 10a2 2 0 0 1 2-2H9a2 2 0 0 1 2 2v3.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2v-3.5Zm2-.5H9a.5.5 0 0 1 .5.5v3.5a.5.5 0 0 1-.5.5H5.5a.5.5 0 0 1-.5-.5v-3.5a.5.5 0 0 1 .5-.5Zm9.5-11a2 2 0 0 0-2 2v3.5a2 2 0 0 0 2 2h3.5a2 2 0 0 0 2-2v-3.5a2 2 0 0 0-2-2H15Zm3.5 1.5H15a.5.5 0 0 0-.5.5v3.5a.5.5 0 0 0 .5.5h3.5a.5.5 0 0 0 .5-.5v-3.5a.5.5 0 0 0-.5-.5Z"
      clipRule="evenodd"
    />
    <Path
      fill="#000"
      d="M14.25 13.39a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5ZM13 19.64a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0Zm6.25-6.25a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z"
    />
  </Svg>
)
export default SvgComponent
