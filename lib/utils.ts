import { clsx, type ClassValue } from "clsx";
import { Platform } from "react-native";
import { twMerge } from 'tailwind-merge';
import { Address, keccak256, toHex } from "viem";
import { fuse, mainnet } from "viem/chains";

import { useUserStore } from "@/store/useUserStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { refreshToken } from "./api";
import { AuthTokens, Explorers, PasskeyCoordinates, User } from "./types";
import { ADDRESSES } from "./config";

// Import optional dependencies statically
let p256: any;
let AsnParser: any;
let AsnProp: any;
let AsnPropTypes: any;
let AsnType: any;
let AsnTypeTypes: any;

try {
  const curvesModule = require("@noble/curves/p256");
  p256 = curvesModule.p256;
} catch (error) {
  console.warn('@noble/curves/p256 not available:', error);
}

try {
  const asn1Module = require("@peculiar/asn1-schema");
  AsnParser = asn1Module.AsnParser;
  AsnProp = asn1Module.AsnProp;
  AsnPropTypes = asn1Module.AsnPropTypes;
  AsnType = asn1Module.AsnType;
  AsnTypeTypes = asn1Module.AsnTypeTypes;
} catch (error) {
  console.warn('@peculiar/asn1-schema not available:', error);
}

export const IS_SERVER = typeof window === 'undefined';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function eclipseAddress(address: Address, start = 6, end = 4) {
  return address.slice(0, start) + "..." + address.slice(-end);
}

export function eclipseUsername(username: string, start = 10) {
  return username.slice(0, start) + (username.length > start ? "..." : "");
}

export function compactNumberFormat(number: number) {
  return new Intl.NumberFormat("en-us", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(number);
}

export function formatNumber(number: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('en-us', {
    maximumFractionDigits,
  }).format(number);
}

export function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

let globalLogoutHandler: (() => void) | null = null;

export const setGlobalLogoutHandler = (handler: () => void) => {
  globalLogoutHandler = handler;
};

export const withRefreshToken = async <T>(
  apiCall: () => Promise<T>,
  { onError }: { onError?: () => void } = {}
): Promise<T | undefined> => {
  try {
    return await apiCall();
  } catch (error: any) {
    if (error?.status !== 401) {
      console.error(error);
      throw error;
    }
    try {
      const refreshResponse = await refreshToken();

      if (refreshResponse.ok) {
        // Only save new tokens on mobile platforms
        // On web, we don't need to save new tokens
        // because the browser will handle it
        if (Platform.OS === "ios" || Platform.OS === "android") {
          await saveNewTokens(refreshResponse);
        }

        // Retry original request with new access token
        return await apiCall();
      }
    } catch (refreshTokenError) {
      console.error(refreshTokenError);
      if (onError) {
        onError();
      } else {
        globalLogoutHandler?.();
      }
    }
  }
};

async function saveNewTokens(refreshResponse: Response) {
  const refreshTokenResponse: { tokens: AuthTokens } =
    await refreshResponse.json();

  const newTokens = refreshTokenResponse.tokens;

  // Update stored tokens
  if (Platform.OS === "ios" || Platform.OS === "android") {
    const { users, updateUser } = useUserStore.getState();
    const currentUser = users.find((user: User) => user.selected);

    if (!currentUser) throw new Error("No current user found");

    if (newTokens.accessToken) {
      updateUser({
        ...currentUser,
        tokens: {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
        },
      });
    }
  }
}

// see: https://github.com/MasterKale/SimpleWebAuthn/blob/736ea0360953d7ce6a0b4390ce260d0bcab1e191/packages/browser/src/helpers/bufferToBase64URLString.ts
export function bufferToBase64URLString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";

  for (const charCode of bytes) {
    str += String.fromCharCode(charCode);
  }

  const base64String = btoa(str);

  return base64String.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Convert URL-safe base64 to standard base64 and add padding if needed
  const standardBase64 = base64.replace(/-/g, "+").replace(/_/g, "/");
  const paddedBase64 =
    standardBase64 + "=".repeat((4 - (standardBase64.length % 4)) % 4);

  const binaryString = atob(paddedBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64ToHex(base64: string): string {
  // Convert URL-safe base64 to standard base64 and add padding if needed
  const standardBase64 = base64.replace(/-/g, "+").replace(/_/g, "/");
  const paddedBase64 =
    standardBase64 + "=".repeat((4 - (standardBase64.length % 4)) % 4);

  const binaryString = atob(paddedBase64);
  let hex = "";
  for (let i = 0; i < binaryString.length; i++) {
    const byte = binaryString.charCodeAt(i);
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const base64Fixed = base64.replace(/-/g, "+").replace(/_/g, "/");
  const binaryBuffer = Buffer.from(base64Fixed, "base64");

  return new Uint8Array(binaryBuffer);
}

function importLibs() {
  if (!p256 || !AsnParser || !AsnProp || !AsnPropTypes || !AsnType || !AsnTypeTypes) {
    throw new Error('Required cryptographic libraries are not available. Please ensure @noble/curves and @peculiar/asn1-schema are installed.');
  }

  @AsnType({ type: AsnTypeTypes.Sequence })
  class AlgorithmIdentifier {
    @AsnProp({ type: AsnPropTypes.ObjectIdentifier })
    public id = "";

    @AsnProp({ type: AsnPropTypes.ObjectIdentifier, optional: true })
    public curve = "";
  }

  @AsnType({ type: AsnTypeTypes.Sequence })
  class ECPublicKey {
    @AsnProp({ type: AlgorithmIdentifier })
    public algorithm = new AlgorithmIdentifier();

    @AsnProp({ type: AsnPropTypes.BitString })
    public publicKey: ArrayBuffer = new ArrayBuffer(0);
  }

  return {
    p256,
    AsnParser,
    ECPublicKey,
  };
}

export async function decodePublicKeyForReactNative(
  publicKey: string
): Promise<PasskeyCoordinates> {
  const { p256, AsnParser, ECPublicKey } = importLibs();

  let publicKeyBytes = base64ToUint8Array(publicKey);

  if (publicKeyBytes.length === 0) {
    throw new Error("Decoded public key is empty.");
  }

  const isAsn1Encoded = publicKeyBytes[0] === 0x30;
  const isUncompressedKey = publicKeyBytes.length === 64;

  if (isAsn1Encoded) {
    const asn1ParsedKey = AsnParser.parse(
      publicKeyBytes.buffer as ArrayBuffer,
      ECPublicKey
    );

    publicKeyBytes = new Uint8Array(asn1ParsedKey.publicKey);
  } else if (isUncompressedKey) {
    const uncompressedKey = new Uint8Array(65);
    uncompressedKey[0] = 0x04;
    uncompressedKey.set(publicKeyBytes, 1);

    publicKeyBytes = uncompressedKey;
  }

  const point = p256.ProjectivePoint.fromHex(publicKeyBytes);

  const x = point.x.toString(16).padStart(64, "0");
  const y = point.y.toString(16).padStart(64, "0");

  return {
    x: "0x" + x,
    y: "0x" + y,
  };
}

export async function decodePublicKey(
  response: AuthenticatorResponse
): Promise<PasskeyCoordinates> {
  const publicKeyAuthenticatorResponse =
    response as AuthenticatorAttestationResponse;
  const publicKey = publicKeyAuthenticatorResponse.getPublicKey();

  if (!publicKey) {
    throw new Error(
      "Failed to generate passkey coordinates. getPublicKey() failed"
    );
  }

  if (typeof publicKey === "string") {
    // Public key is base64 encoded
    // - React Native platform uses base64 encoded strings
    return decodePublicKeyForReactNative(publicKey);
  }

  if (publicKey instanceof ArrayBuffer) {
    // Public key is an ArrayBuffer
    // - Web platform uses ArrayBuffer
    return await decodePublicKeyForWeb(publicKey);
  }

  throw new Error("Unsupported public key format.");
}

export async function decodePublicKeyForWeb(
  publicKey: string | ArrayBuffer
): Promise<PasskeyCoordinates> {
  const algorithm = {
    name: "ECDSA",
    namedCurve: "P-256",
    hash: { name: "SHA-256" },
  };

  const keyBuffer =
    typeof publicKey === "string" ? base64ToArrayBuffer(publicKey) : publicKey;

  const key = await crypto.subtle.importKey(
    "spki",
    keyBuffer,
    algorithm,
    true,
    ["verify"]
  );

  const { x, y } = await crypto.subtle.exportKey("jwk", key);

  const isValidCoordinates = !!x && !!y;

  if (!isValidCoordinates) {
    throw new Error(
      "Failed to generate passkey Coordinates. crypto.subtle.exportKey() failed"
    );
  }

  return {
    x: "0x" + base64ToHex(x),
    y: "0x" + base64ToHex(y),
  };
}

export const getNonce = async ({
  appId,
}: {
  appId: string;
}): Promise<bigint> => {
  const accountNonce = await AsyncStorage.getItem("accountNonce");
  const nonce = parseInt(accountNonce || "0");
  const encodedNonce = keccak256(toHex(appId + nonce.toString()));
  return BigInt(encodedNonce);
};

export const isSoUSDEthereum = (contractAddress: string): boolean => {
  return contractAddress.toLowerCase() === ADDRESSES.ethereum.vault.toLowerCase();
};

export const isSoUSDFuse = (contractAddress: string): boolean => {
  return contractAddress.toLowerCase() === ADDRESSES.fuse.vault.toLowerCase();
};

export const isSoUSDToken = (contractAddress: string): boolean => {
  return isSoUSDEthereum(contractAddress) || isSoUSDFuse(contractAddress);
};

export const layerzero = {
  id: 0,
  blockExplorers: {
    default: {
      name: "LayerZeroScan",
      url: "https://layerzeroscan.com",
    },
  },
}

export const explorerUrls: Record<number, Explorers> = {
  [layerzero.id]: {
    layerzeroscan: layerzero.blockExplorers?.default.url,
  },
  [mainnet.id]: {
    blockscout: "https://eth.blockscout.com",
    etherscan: mainnet.blockExplorers?.default.url,
  },
  [fuse.id]: {
    blockscout: fuse.blockExplorers?.default.url
  },
}
