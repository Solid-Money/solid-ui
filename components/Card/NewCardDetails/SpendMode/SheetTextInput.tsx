import { TextInput } from 'react-native';

/**
 * A text field for a body rendered inside `CardBottomSheet`.
 *
 * Plain `TextInput` on web, where the sheet is a dialog and the browser keeps a focused
 * field in view on its own. Native has its own version in `SheetTextInput.native.tsx`.
 */
const SheetTextInput = TextInput;

export default SheetTextInput;
