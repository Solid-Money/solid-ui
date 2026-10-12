import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * The 20pt "?" the spend-mode surfaces put beside a figure or a caption (Figma
 * exports it as a circle at 20% white with a plain type glyph). The question
 * mark uses centered vector bounds so font baselines and text scaling can't
 * shift it inside the fixed-size circle.
 */
const HelpBadge = () => (
  <View style={styles.badge}>
    <Svg accessible={false} width={7.38} height={10.46} viewBox="16.6365 13.003 12.121 17.181">
      <Path
        d="M21.9035 25.86C21.8575 23.583 23.0765 22.364 24.7785 21.053C26.2045 19.926 27.0785 19.19 27.0785 17.672C27.0785 15.533 25.6295 14.36 22.7775 14.36C19.9945 14.36 18.4765 15.763 18.2695 18.201H16.6365C16.8895 14.82 19.0515 13.003 22.8465 13.003C26.7335 13.003 28.7575 14.705 28.7575 17.672C28.7575 19.857 27.6535 20.892 25.9975 22.111C24.3185 23.353 23.4445 24.319 23.3065 25.883L23.2605 26.481H21.9265L21.9035 25.86ZM22.6625 30.184C21.9955 30.184 21.5355 29.724 21.5355 29.126C21.5355 28.528 21.9955 28.091 22.6625 28.091C23.3295 28.091 23.7895 28.528 23.7895 29.126C23.7895 29.724 23.3295 30.184 22.6625 30.184Z"
        fill="white"
        fillOpacity={0.7}
      />
    </Svg>
  </View>
);

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
});

export default HelpBadge;
