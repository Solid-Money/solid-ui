# Solid 💰

A next-generation crypto savings app that combines traditional banking convenience with DeFi innovation. Earn high yields on your crypto assets while maintaining security through advanced wallet infrastructure and account abstraction.

## 🎯 Overview

Solid is a React Native/Expo mobile application that provides users with:
- **High-yield crypto savings** with real-time APY calculation
- **Smart wallet infrastructure** using passkey authentication
- **DeFi features** including swaps, staking, and liquidity provision
- **Banking-like experience** with virtual debit cards and bank transfers
- **Multi-chain support** across Ethereum, Fuse Network, Polygon, Base, and Arbitrum

## ✨ Key Features

### 🔐 Smart Wallet & Security
- **Passkey Authentication**: WebAuthn/FIDO2 standards eliminate seed phrase risks
- **Account Abstraction**: Safe smart accounts with ERC-4337 implementation
- **Hardware Security**: Device secure enclave for key protection
- **Turnkey Integration**: Secure custody and key management infrastructure
- **Persona KYC**: Identity verification and compliance

### 💎 Crypto Savings & DeFi
- **High-Yield Savings**: Earn competitive APY on various tokens
- **Automated Compounding**: Real-time yield calculations and compound interest
- **Token Swapping**: Integrated Voltage DEX using Algebra Protocol
- **Cross-Chain Bridging**: Seamless asset transfers between networks
- **Staking & Liquidity**: Earn additional rewards through DeFi protocols

### 🏦 Banking Features
- **Virtual Debit Card**: Spend crypto anywhere cards are accepted
- **Bank Transfers**: ACH/wire integration for fiat on/off ramps
- **P2P Payments**: Send crypto via username or address
- **Transaction History**: Comprehensive activity tracking and analytics

### 🎮 Rewards & Gamification
- **Points System**: Earn points for app activities
- **Referral Program**: Invite friends and earn rewards together
- **Achievement System**: Unlock benefits through engagement
- **Rewards Integration**: Additional reward mechanisms

### 📊 Analytics & Support
- **Amplitude Analytics**: User behavior tracking and insights
- **Firebase Analytics**: Event tracking and user engagement
- **Sentry Integration**: Error monitoring and performance tracking
- **Intercom Support**: In-app customer support and messaging

## 🛠️ Technology Stack

### Core Technologies
- **React Native** 0.79.5 with **Expo** 53.0.20
- **TypeScript** with strict type checking
- **NativeWind** (Tailwind CSS for React Native)

### Web3 Infrastructure
- **Wagmi** 2.15.7 for Ethereum interactions
- **Viem** for blockchain utilities and type safety
- **Permissionless.js** for account abstraction (ERC-4337)
- **Safe** smart wallet ecosystem
- **Turnkey SDK** for secure key management

### State & Data Management
- **Zustand** 5.0.6 for global state management
- **React Query** (@tanstack/react-query 5.83.0) for server state
- **Apollo Client** 3.13.8 for GraphQL and The Graph integration
- **MMKV** 3.3.0 for performant local storage

### DeFi Integration
- **ThirdWeb** 5.105.21 for Web3 development
- **CryptoAlgebra Fuse SDK** for DEX functionality
- **Voltage Finance SDK** 1.0.5 for additional DEX features
- **LiFi** integration for cross-chain bridging
- **Multiple networks**: Ethereum, Fuse, Polygon, Base, Arbitrum

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ (Node.js 18 reached EOL in April 2025)
- iOS Simulator or Android Emulator
- Expo CLI

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Solid-Money/solid-ui.git
   cd solid-ui
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env.local
   # Configure your environment variables
   ```

4. **Start the development server**
   ```bash
   npx expo start
   ```

5. **Launch the app**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app for physical device testing

## 📱 Development

### Project Structure
```
├── app/                    # File-based routing (Expo Router)
│   ├── (protected)/       # Authenticated routes
│   │   └── (tabs)/        # Main tab navigation
│   ├── _layout.tsx        # Root layout
│   ├── register.tsx       # User registration
│   └── welcome.tsx        # Onboarding
├── components/            # Reusable UI components
├── lib/                   # Core utilities and APIs
├── hooks/                 # Custom React hooks
├── store/                 # Zustand state management
├── constants/             # App constants and configuration
├── assets/                # Images and static files
└── generated/             # Auto-generated files (GraphQL, Wagmi)
```

### Key Directories
- **`app/(protected)/(tabs)/`**: Main authenticated screens (Home, Savings, Activity, etc.)
- **`components/`**: Organized by feature (Dashboard, Wallet, BankTransfer, etc.)
- **`lib/`**: Core business logic, API calls, and Web3 utilities
- **`hooks/`**: Custom hooks for Web3, authentication, and data fetching
- **`store/`**: Global state management with Zustand

### Available Scripts
```bash
npm start             # Start Expo development server
npm run android       # Run on Android emulator  
npm run ios          # Run on iOS simulator
npm run web          # Run in web browser
npm run lint         # Run ESLint with auto-fix (uses expo lint)
npm run codegen      # Generate GraphQL types from schema
npm run wagmi-generate # Generate Wagmi hooks from contracts
```

## 🖼️ Asset Management 

The project uses a hybrid asset management system optimized for both Mobile (local/offline) and Web (CDN/caching). 

### How to Add an Asset 

1. **Place the file**: Add your image, animation, or font to the appropriate subdirectory in the `assets/` folder. 
2. **Update the Registry**: Run the following command to update the type-safe asset registry: 
   ```bash 
   npm run assets:update 
   ``` 
   *Note: This runs automatically on `npm install` and during builds.* 

### How to Use Assets 

Always use the `getAsset` or `getImageUrl` helpers from `lib/assets.ts`. **Do not** use `require()` directly in your components. 

**Standard Usage (Components)**: 
```tsx 
import { getAsset } from "@/lib/assets"; 
import { Image } from "expo-image"; 

<Image source={getAsset("images/logo.png")} style={{ width: 100, height: 100 }} /> 
``` 

**String URL Usage (External links/CSS)**: 
```tsx 
import { getImageUrl } from "@/lib/assets"; 

const url = getImageUrl("images/banner.png"); 
``` 

### How it Works 

- **Mobile**: `getAsset` returns the local `require()` module. Assets are bundled into the app for offline support. 
- **Web (Production)**: `getAsset` returns a CDN URL pointing to your domain. 
- **Caching**: Assets on Web are served with a 30-day cache. To prevent stale content, the system automatically appends a content-based hash to the URL (e.g., `logo.png?v=a1b2c3d4`). The hash only changes if the file content changes. 


## 🔧 Configuration

### Environment Variables
Key environment variables (see `.env.example`):
- `EXPO_PUBLIC_BASE_URL`: Frontend domain URL (used for redirects and assets on Web)
- `EXPO_PUBLIC_ALCHEMY_API_KEY`: Alchemy API key for blockchain data
- `EXPO_PUBLIC_ETHEREUM_API_KEY`: Ethereum API key
- `EXPO_PUBLIC_PIMLICO_API_KEY`: Pimlico paymaster API key
- `EXPO_PUBLIC_FLASH_API_BASE_URL`: Solid API configuration
- `EXPO_PUBLIC_FLASH_ANALYTICS_API_BASE_URL`: Solid analytics endpoint
- `EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS`: Bridge auto-deposit address
- `EXPO_PUBLIC_AMPLITUDE_API_KEY`: Amplitude analytics
- `EXPO_PUBLIC_INFO_GRAPH`: The Graph endpoint for project data
- `EXPO_PUBLIC_ALGEBRA_INFO_GRAPH`: The Graph endpoint for DEX data
- `EXPO_PUBLIC_COIN_GECKO_API_KEY`: CoinGecko API for price data
- `EXPO_PUBLIC_THIRDWEB_CLIENT_ID`: ThirdWeb client configuration
- `EXPO_PUBLIC_TURNKEY_API_BASE_URL`: Turnkey API endpoint
- `EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID`: Turnkey organization ID
- `EXPO_PUBLIC_REOWN_PROJECT_ID`: Reown (formerly WalletConnect) project ID
- `EXPO_PUBLIC_PASSKEY_CERTIFICATES_HOST`: Passkey certificates host
- `EXPO_PUBLIC_WAITLIST_API_BASE_URL`: Waitlist API endpoint
- `EXPO_PUBLIC_ENVIRONMENT`: Environment configuration
- `GOOGLE_SERVICES_JSON/PLIST`: Firebase configuration files
- `SENTRY_AUTH_TOKEN`: Sentry authentication token

### Blockchain Configuration
- **Ethereum Mainnet**: Primary network for high-value transactions
- **Fuse Network**: Low-cost transactions and yield farming
- **Layer 2s**: Polygon, Base, Arbitrum for optimized costs
- **Custom RPCs**: Configured via Alchemy for reliability

## 🧪 Testing

### Testing Setup
Currently, the project does not have a formal test suite configured. Testing infrastructure needs to be set up.

### Recommended Testing Strategy
- **Unit Tests**: Components and utilities (Jest + React Native Testing Library)
- **Integration Tests**: Web3 interactions and API calls
- **E2E Tests**: Critical user flows with Detox or Maestro

### Setup Testing (TODO)
```bash
# Install testing dependencies
npm install --save-dev jest @testing-library/react-native
# Add test scripts to package.json
# Create __tests__ directories
```

## 🚢 Deployment

### Build Configuration
The app uses EAS Build for deployment:

```bash
# Development build
eas build --profile development

# Preview build  
eas build --profile preview

# Production build
eas build --profile production
```

### App Store Deployment
- **iOS**: Automated via EAS Submit to App Store Connect
- **Android**: Play Console deployment with internal track testing
- **OTA Updates**: Expo Updates for JavaScript bundle updates

## 🔐 Security

### Authentication Flow
1. **Passkey Registration**: WebAuthn credential creation
2. **Turnkey Integration**: Secure key generation and storage
3. **Smart Account Creation**: Safe wallet deployment
4. **Multi-factor Protection**: Device biometrics + passkey

### Best Practices
- All sensitive operations require user confirmation
- Private keys never leave secure hardware
- GraphQL operations are rate-limited and validated
- Smart contracts undergo regular audits

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes following coding standards
4. Run tests and linting (`npm run lint && npm test`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Standards
- **TypeScript**: Strict typing required
- **ESLint**: Follow Expo configuration
- **Prettier**: Auto-formatting enabled
- **Conventional Commits**: Use semantic commit messages

## 📄 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For technical issues or questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation wiki

---

**Built with ❤️ by the Solid team**
