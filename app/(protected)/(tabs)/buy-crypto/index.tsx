import { Text } from "@/components/ui/text";
import useUser from "@/hooks/useUser";
import { getClientIp } from "@/lib/api";
import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

interface MercuryoIframeWidgetProps {
  onClose?: () => void;
}

// Same signature creation function
export async function createWidgetSignature({
  address,
  secret,
  ip,
  merchantTransactionId,
}: {
  address: string;
  secret: string;
  ip: string;
  merchantTransactionId: string;
}): Promise<string> {
  const concatenatedString = `${address}${secret}${ip}${merchantTransactionId}`;

  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA512,
    concatenatedString
  );

  return `v2:${hash}`;
}

// Build Mercuryo widget URL
export async function buildMercuryoWidgetUrl({
  address,
  userId,
  widgetId,
  widgetSecret,
  userIp,
}: {
  address: string;
  userId: string;
  widgetId: string;
  widgetSecret: string;
  userIp: string;
}): Promise<string> {
  const merchantTransactionId = `${userId}-${Date.now().toString()}`;

  try {
    const signature = await createWidgetSignature({
      address,
      secret: widgetSecret,
      ip: userIp,
      merchantTransactionId,
    });

    let url = `https://exchange.mercuryo.io/?widget_id=${widgetId}`;
    url += `&address=${address}`;
    url += `&merchant_transaction_id=${merchantTransactionId}`;
    url += `&signature=${encodeURIComponent(signature)}`;
    url += `&type=buy`;
    url += `&fiat_currency=EUR`;
    url += `&networks=ETHEREUM`;
    url += `&currency=USDC`;

    return url;
  } catch (error) {
    console.error("Error generating Mercuryo widget URL:", error);
    throw error;
  }
}

export default function MercuryoIframeWidget({
  onClose,
}: MercuryoIframeWidgetProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalUrl, setFinalUrl] = useState<string>("");

  const { user } = useUser();
  const handleClose = useCallback((success = false) => {
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  }, [onClose, router]);

  // Handle iframe load events
  const handleIframeLoad = () => {
    setLoading(false);
  };

  const handleIframeError = () => {
    setError("Failed to load Mercuryo widget. Please try again later.");
    setLoading(false);
  };

  // Setup message listener for transaction completion
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      console.log("Mercuryo message received:", event.data);

      try {
        // Check for completion events from Mercuryo
        if (typeof event.data === "object") {
          if (
            event.data.status === "success" ||
            event.data.event === "transaction.success"
          ) {
            handleClose(true);
          } else if (
            event.data.status === "failure" ||
            event.data.event === "transaction.failure"
          ) {
            handleClose(false);
          }
        }
      } catch (err) {
        console.error("Error handling Mercuryo message:", err);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleClose]);

  // Build the Mercuryo widget URL
  useEffect(() => {
    const buildUrl = async () => {
      // Reset error when user data changes
      setError(null);

      const address = user?.safeAddress;

      console.log("address", address);

      // If user object doesn't exist yet, keep loading
      if (!user) {
        return;
      }

      // If user exists but no address, show error
      if (!address) {
        setError("No address provided");
        setLoading(false);
        return;
      }

      try {
        const userIp = await getClientIp();
        const widgetId = process.env.EXPO_PUBLIC_MERCURYO_WIDGET_ID;
        const widgetSecret = process.env.EXPO_PUBLIC_MERCURYO_WIDGET_SECRET;

        if (!widgetId || !widgetSecret) {
          throw new Error("Mercuryo widget ID or secret is not set");
        }

        const widgetUrl = await buildMercuryoWidgetUrl({
          address,
          userId: user.userId,
          widgetId,
          widgetSecret,
          userIp,
        });

        console.log("Built Mercuryo URL:", widgetUrl);
        setFinalUrl(widgetUrl);
      } catch (err) {
        console.error("Error building Mercuryo URL:", err);
        setError("Failed to initialize widget");
        setLoading(false);
      }
    };

    buildUrl();
  }, [user]); // Also depend on the entire user object, not just safeAddress

  return (
    <View style={styles.container}>
      {loading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#000" />
        </View>
      )}

      {error ? (
        <View className="flex-1 items-center justify-center">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : finalUrl ? (
        <iframe
          src={finalUrl}
          style={styles.iframe}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          allow="camera; microphone; geolocation; payment"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
    color: "#fff",
  },
  errorText: {
    textAlign: "center",
    marginTop: 20,
    color: "red",
    fontSize: 16,
  },
  iframe: {
    width: "100%",
    height: "100%",
  },
});

// Add type declaration
declare global {
  interface Window {
    mercuryoWidget: any;
  }
}
