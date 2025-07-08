import { Image } from "expo-image";
import { Link, router } from "expo-router";
import { Platform, SafeAreaView, View } from "react-native";

import { path } from "@/constants/path";
import AccountCenterModal from "../AccountCenter/AccountCenterModal";
import { NavMenu } from "./NavMenu";
import useUser from "@/hooks/useUser";
import { Button } from "../ui/button";
import { Text } from "../ui/text";

const Navbar = () => {
  const { user } = useUser();
  const hasDeposited = user?.isDeposited;

  return (
    <SafeAreaView className="sticky top-0 z-50 bg-background/10 backdrop-blur-lg border-b border-border/40">
      <View className="flex-row justify-end md:justify-between items-center p-4 md:py-6 w-full max-w-7xl mx-auto">
        <Link href={path.HOME} className="hidden md:flex flex-row items-center gap-2">
          <Image
            source={require("@/assets/images/solid-logo.png")}
            alt="Solid logo"
            contentFit="contain"
            style={{ width: 20, height: 20 }}
          />
          <Image
            source={require("@/assets/images/solid-4x.png")}
            alt="Solid"
            contentFit="contain"
            style={{ width: 68, height: 23 }}
            className="hidden md:block"
          />
        </Link>
        {hasDeposited && (
          <NavMenu />
        )}
        <Button onPress={() => {
          router.push(path.CARD);
        }}>
          <Text>
            Card
          </Text>
        </Button>
        {Platform.OS === 'web' && (
          <View className="w-32">
            <AccountCenterModal />
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

export default Navbar;
