import { Text } from "@/components/ui/text";
import useUser from "@/hooks/useUser";
import { createMercuryoTransaction, getClientIp } from "@/lib/api";
import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

interface MercuryoIframeWidgetProps {
  onClose?: () => void;
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

  // Create Mercuryo transaction and get widget URL
  useEffect(() => {
    const buildUrl = async () => {
      // Reset error when user data changes
      setError(null);

      // If user object doesn't exist yet, keep loading
      if (!user) {
        return;
      }

      try {
        const userIp = await getClientIp();
        const transactionId = Crypto.randomUUID();
        
        const widgetUrl = await createMercuryoTransaction(userIp, transactionId);
        setFinalUrl(widgetUrl);
      } catch (err) {
        console.error("Error creating Mercuryo transaction:", err);
        setError("Failed to initialize widget");
        setLoading(false);
      }
    };

    buildUrl();
  }, [user]);

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
