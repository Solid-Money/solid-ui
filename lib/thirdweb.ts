import { createThirdwebClient } from "thirdweb";

import { EXPO_PUBLIC_THIRDWEB_CLIENT_ID } from "./config";

export const client = createThirdwebClient({
  clientId: EXPO_PUBLIC_THIRDWEB_CLIENT_ID
});
