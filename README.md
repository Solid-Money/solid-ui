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
- **Zustand** for global state management
- **React Query** (@tanstack/react-query) for server state
- **Apollo Client** for GraphQL and The Graph integration
- **MMKV** for performant local storage

### DeFi Integration
- **ThirdWeb** SDK for Web3 development
- **CryptoAlgebra Fuse SDK** for DEX functionality
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
npm run lint         # Run ESLint with auto-fix
npm run codegen      # Generate GraphQL types from schema
npm run wagmi-generate # Generate Wagmi hooks from contracts
```

## 🔧 Configuration

### Environment Variables
Key environment variables (see `.env.example`):
- `EXPO_PUBLIC_BASE_URL`: Backend API endpoint
- `EXPO_PUBLIC_ALCHEMY_API_KEY`: Alchemy API key for blockchain data
- `EXPO_PUBLIC_TURNKEY_API_BASE_URL`: Turnkey API configuration
- `EXPO_PUBLIC_INFO_GRAPH`: The Graph endpoint for project data
- `EXPO_PUBLIC_ALGEBRA_INFO_GRAPH`: The Graph endpoint for DEX data
- `EXPO_PUBLIC_THIRDWEB_CLIENT_ID`: ThirdWeb client configuration
- `EXPO_PUBLIC_PIMLICO_API_KEY`: Pimlico paymaster API key
- `GOOGLE_SERVICES_JSON/PLIST`: Firebase configuration

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
