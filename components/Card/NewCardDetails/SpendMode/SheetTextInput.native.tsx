import { BottomSheetTextInput } from '@gorhom/bottom-sheet';

/**
 * The native half of `SheetTextInput`: Gorhom's own input, which is what tells the sheet a
 * keyboard is coming. A plain `TextInput` inside a `BottomSheetModal` leaves the sheet where
 * it is and the keyboard covers the field being typed into.
 */
const SheetTextInput = BottomSheetTextInput;

export default SheetTextInput;
