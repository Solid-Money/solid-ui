import axios, { AxiosRequestHeaders } from "axios";
import { Platform } from "react-native";
import {
	AuthenticationResponseJSON,
	RegistrationResponseJSON,
} from "react-native-passkeys/src/ReactNativePasskeys.types";

import { useUserStore } from "@/store/useUserStore";
import {
	EXPO_PUBLIC_COIN_GECKO_API_KEY,
	EXPO_PUBLIC_FLASH_ANALYTICS_API_BASE_URL,
	EXPO_PUBLIC_FLASH_API_BASE_URL,
} from "./config";
import {
	BlockscoutTransaction,
	BridgeCustomerResponse,
	CardResponse,
	CardStatusResponse,
	KycLink,
	LayerZeroTransaction,
	TokenPriceUsd,
	User,
} from "./types";

// Helper function to get platform-specific headers
const getPlatformHeaders = () => {
	const headers: Record<string, string> = {};
	if (Platform.OS === 'ios' || Platform.OS === 'android') {
		headers['X-Platform'] = 'mobile';
	}
	return headers;
};

// Helper function to get JWT token for mobile
const getJWTToken = (): string | null => {
	if (Platform.OS === 'ios' || Platform.OS === 'android') {
		const { users } = useUserStore.getState();
		const currentUser = users.find((user: User) => user.selected);
		console.log("currentUser", currentUser);
		return currentUser?.tokens?.accessToken || null;
	}
	return null;
};


// Helper function to get refresh token
const getRefreshToken = (): string | null => {
	if (Platform.OS === 'ios' || Platform.OS === 'android') {
		const { users } = useUserStore.getState();
		const currentUser = users.find((user: User) => user.selected);
		return currentUser?.tokens?.refreshToken || null;
	}
	return null;
};

// Set up axios interceptor to add headers to all axios requests
axios.interceptors.request.use((config) => {
	const platformHeaders = getPlatformHeaders();

	config.headers = {
		...config.headers,
		...platformHeaders,
	} as AxiosRequestHeaders;

	if (Platform.OS === "ios" || Platform.OS === "android") {
		const jwtToken = getJWTToken();

		if (jwtToken) {
			config.headers['Authorization'] = `Bearer ${jwtToken}`;
		} else {
			console.error("No JWT token found");
		}
	}

	return config;
});

export const refreshToken = () => {
	const refreshTokenValue = getRefreshToken();

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...getPlatformHeaders(),
	};

	if (refreshTokenValue) {
		headers['Authorization'] = `Bearer ${refreshTokenValue}`;
	}
	
	return fetch(
		`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/auths/refresh-token`,
		{
			method: "POST",
			credentials: "include",
			headers,
		},
	);
};

// use fetch because some browser doesn't support fetch wrappers such as axios
// see: https://simplewebauthn.dev/docs/advanced/browser-quirks#safari
export const generateRegistrationOptions = async (username: string) => {
	const response = await fetch(
		`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/passkeys/registration/generate-options`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...getPlatformHeaders(),
			},
			credentials: "include",
			body: JSON.stringify({ username }),
		},
	);
	if (!response.ok) throw response;
	return response.json();
};

export const verifyRegistration = async (
	registrationResponse: RegistrationResponseJSON,
	sessionId: string,
	address: string,
): Promise<User> => {
	const response = await fetch(
		`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/passkeys/registration/verify`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...getPlatformHeaders(),
			},
			credentials: "include",
			body: JSON.stringify({
				...registrationResponse,
				sessionId,
				address,
			}),
		},
	);
	if (!response.ok) throw response;
	return response.json();
};

export const generateAuthenticationOptions = async () => {
	const response = await fetch(
		`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/passkeys/authentication/generate-options`,
		{
			credentials: "include",
			headers: {
				...getPlatformHeaders(),
			},
		},
	);
	if (!response.ok) throw response;
	return response.json();
};

export const verifyAuthentication = async (
	authenticationResponse: AuthenticationResponseJSON,
	sessionId: string,
): Promise<User> => {
	const response = await fetch(
		`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/passkeys/authentication/verify`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...getPlatformHeaders(),
			},
			credentials: "include",
			body: JSON.stringify({
				...authenticationResponse,
				sessionId,
			}),
		},
	);
	if (!response.ok) throw response;
	return response.json();
};

export const fetchTotalAPY = async () => {
	const response = await axios.get<number>(
		`${EXPO_PUBLIC_FLASH_ANALYTICS_API_BASE_URL}/analytics/v1/yields/total-apy`,
	);
	return response.data;
};

export const fetchTokenTransfer = async (
	address: string,
	token: string,
	type = "ERC-20",
	filter = "to",
) => {
	const response = await axios.get<BlockscoutTransaction>(
		`https://explorer.fuse.io/api/v2/addresses/${address}/token-transfers?type=${type}&filter=${filter}&token=${token}`,
	);
	return response.data;
};

export const fetchTokenPriceUsd = async (token: string) => {
	const response = await axios.get<TokenPriceUsd>(
		`https://pro-api.coingecko.com/api/v3/simple/price?ids=${token}&vs_currencies=usd`,
		{
			headers: {
				"x-cg-pro-api-key": EXPO_PUBLIC_COIN_GECKO_API_KEY,
			},
		},
	);
	return response.data[token].usd;
};

export const createKycLink = async (
	fullName: string,
	email: string,
	redirectUri: string,
): Promise<KycLink> => {
	const jwt = getJWTToken();

	const response = await fetch(
		`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/kyc/link`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...getPlatformHeaders(),
				...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
			},
			credentials: "include",
			body: JSON.stringify({
				fullName,
				email,
				redirectUri,
			}),
		},
	);

	if (!response.ok) throw response;

	return response.json();
};

export const getKycLink = async (kycLinkId: string): Promise<KycLink> => {
	const jwt = getJWTToken();

	const response = await fetch(
		`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/kyc/link/${kycLinkId}`,
		{
			credentials: "include",
			headers: {
				...getPlatformHeaders(),
				...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
			},
		},
	);

	if (!response.ok) throw response;

	return response.json();
};

export const getCustomer = async (): Promise<BridgeCustomerResponse | null> => {
	const jwt = getJWTToken();

	const response = await fetch(
		`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/bridge-customer`,
		{
			credentials: "include",
			headers: {
				...getPlatformHeaders(),
				...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
			},
		},
	);

	if (response.status === 404) return null;

	if (!response.ok) throw response;

	return response.json();
};

export const createCard = async (): Promise<CardResponse> => {
	const jwt = getJWTToken();

	const response = await fetch(
		`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...getPlatformHeaders(),
				...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
			},
			credentials: "include",
		},
	);

	if (!response.ok) throw response;

	return response.json();
};

export const getCardStatus = async (): Promise<CardStatusResponse> => {
	const jwt = getJWTToken();

	const response = await fetch(
		`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/status`,
		{
			credentials: "include",
			headers: {
				...getPlatformHeaders(),
				...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
			},
		},
	);

	if (!response.ok) throw response;

	return response.json();
};

export const getCardDetails = async (): Promise<CardResponse> => {
	const jwt = getJWTToken();

	const response = await fetch(
		`${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cards/details`,
		{
			credentials: "include",
			headers: {
				...getPlatformHeaders(),
				...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
			},
		},
	);

	if (!response.ok) throw response;

	return response.json();
};

export const fetchInternalTransactions = async (
	address: string,
): Promise<BlockscoutTransaction> => {
	const response = await axios.get(
		`https://eth.blockscout.com/api/v2/addresses/${address}/internal-transactions?filter=from`,
	);
	return response.data;
};

export const fetchTransactionTokenTransfers = async (
	transactionHash: string,
	type = "ERC-20",
): Promise<BlockscoutTransaction> => {
	const response = await axios.get(
		`https://eth.blockscout.com/api/v2/transactions/${transactionHash}/token-transfers?type=${type}`,
	);
	return response.data;
};

export const fetchLayerZeroBridgeTransactions = async (transactionHash: string): Promise<LayerZeroTransaction> => {
	const response = await axios.get(`https://scan.layerzero-api.com/v1/messages/tx/${transactionHash}`);
	return response.data;
}

export const getClientIp = async () => {
	try {
		const response = await axios.get("https://api.ipify.org?format=json")
		return response.data.ip
	} catch (error) {
		console.error("Error fetching IP from ipify:", error);
	}
}
