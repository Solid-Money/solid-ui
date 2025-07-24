import { Pressable } from "react-native";

import { Text } from "@/components/ui/text";

type MaxProps = {
  onPress: () => void;
}

const Max = ({ onPress }: MaxProps) => {
  return (
    <Pressable onPress={onPress}>
      <Text className="font-medium web:hover:opacity-70">Max</Text>
    </Pressable>
  );
}

export default Max;
