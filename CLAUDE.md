# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MiniAppM2M is an anti-spam messaging system built as a Farcaster miniapp that integrates XMTP for messaging with a Celo blockchain-based payment system. Users can message contacts for free mutually, or purchase message credits to contact new recipients who have set pricing.

**Core Architecture:**
- **Frontend**: Next.js 14 (App Router) with TypeScript, Tailwind CSS, shadcn/ui components
- **Messaging**: XMTP (Extensible Message Transport Protocol) for decentralized messaging
- **Smart Contracts**: Dual setup with both Hardhat and Foundry for Solidity development
- **Blockchain**: Celo network (mainnet + Alfajores/Sepolia testnets)
- **Monorepo**: Turborepo with PNPM workspaces

## Development Commands

### Root Level (Monorepo)
```bash
pnpm install                      # Install all dependencies
pnpm dev                          # Start all development servers
pnpm build                        # Build all packages and apps
pnpm lint                         # Lint all packages
pnpm type-check                   # TypeScript type checking across all packages
```

### Web Application (apps/web)
```bash
cd apps/web
pnpm dev                          # Start Next.js dev server (port 3000)
pnpm build                        # Production build
pnpm start                        # Start production server
pnpm lint                         # Lint web app
pnpm type-check                   # Type check web app
```

### Smart Contracts

**Using Hardhat (apps/contracts):**
```bash
# From root:
pnpm contracts:compile            # Compile contracts with Hardhat
pnpm contracts:test               # Run Hardhat tests
pnpm contracts:deploy             # Deploy to local network
pnpm contracts:deploy:alfajores   # Deploy to Celo Alfajores testnet
pnpm contracts:deploy:sepolia     # Deploy to Celo Sepolia testnet
pnpm contracts:deploy:celo        # Deploy to Celo mainnet

# From apps/contracts:
cd apps/contracts
npx hardhat compile
npx hardhat test
npx hardhat verify --network <network> <address>
```

**Using Foundry (apps/contracts):**
```bash
cd apps/contracts
forge build                       # Compile with Foundry
forge test                        # Run Foundry tests
forge test -vvv                   # Verbose test output
forge fmt                         # Format Solidity code
forge snapshot                    # Gas usage snapshots
anvil                            # Start local Ethereum node

# Deploy with Foundry
forge script script/YourScript.s.sol:YourScript --rpc-url <rpc_url> --private-key <key>
```

## Key Architecture Components

### M2MChat Smart Contract System
The core smart contract (`apps/contracts/src/M2MChat.sol`) implements:
- **Mutual contacts**: Free messaging between contacts who have both added each other
- **Paid messaging**: Users can set their own price per message (no upper limit)
- **Message packages**: Purchase message credits in bulk (10-10,000 messages)
- **Platform fees**: 5% fee on all package purchases
- **Relayer system**: Off-chain signature verification for efficient message consumption
- **cUSD payments**: Uses Celo's stable token (0x765DE816845861e75A25fCA122bb6898B8B1282a)

**Contract Architecture:**
- Inherits: `ReentrancyGuard`, `Ownable` from OpenZeppelin
- Uses ECDSA for signature verification
- Implements checkpoint system to avoid per-message on-chain transactions
- Balances tracked per sender-receiver pair with nonce for replay protection

### XMTP Integration
Located in `apps/web/src/lib/xmtp-client.ts` and `apps/web/src/contexts/xmtp-context.tsx`:
- Uses `@xmtp/browser-sdk` v2.0.2 for messaging
- Supports content types: reactions, replies, remote attachments
- Viem wallet integration for XMTP signer creation
- Client initialization with local persistence via `MemoryStore`

### Farcaster Miniapp Integration
The app is a Farcaster Frame v1 with:
- Manifest at `/.well-known/farcaster.json` route
- Account association using signed headers (stored in env vars)
- Frame metadata in `apps/web/src/app/layout.tsx`
- Context provider in `apps/web/src/contexts/miniapp-context.tsx`
- SDK integration via `@farcaster/frame-sdk` and `@farcaster/miniapp-wagmi-connector`

### Frontend Context Architecture
Three main context providers (all in `apps/web/src/contexts/`):
1. **XMTPContext**: XMTP client initialization and state
2. **MiniAppContext**: Farcaster miniapp SDK integration
3. **FrameWalletContext**: Wallet connection via Farcaster frame

All wrapped in `apps/web/src/components/providers.tsx` for the app.

### Anti-Spam System
Implemented in `apps/web/src/lib/anti-spam.ts`:
- Rate limiting: max 50 messages/hour per sender
- Address blocklist/allowlist management
- Integrates with smart contract pricing to prevent unwanted messages

### API Routes Structure
Located in `apps/web/src/app/api/`:
- `/auth`: Farcaster authentication handling
- `/checkpoint`: Relayer checkpoint signing for message consumption
- `/notify`: Notification handling
- `/webhook`: External webhook handling

## Environment Configuration

### Web App Environment Variables
Copy `apps/web/.env.template` to `apps/web/.env.local` and configure:

**Required for Farcaster:**
- `NEXT_PUBLIC_URL`: Your app's public URL
- `NEXT_PUBLIC_FARCASTER_HEADER/PAYLOAD/SIGNATURE`: Account association (see FARCASTER_SETUP.md)
- `JWT_SECRET`: Secure random string for auth

**Required for M2M Contract:**
- `NEXT_PUBLIC_M2M_CONTRACT_ADDRESS`: Deployed M2M contract address
- `NEXT_PUBLIC_CUSD_TOKEN`: cUSD token address (default: Celo mainnet)
- `NEXT_PUBLIC_CHAIN_ID`: 42220 for Celo mainnet
- `RELAYER_PRIVATE_KEY`: Private key for checkpoint signing (backend only)

### Smart Contract Environment Variables
In `apps/contracts/.env`:
- `PRIVATE_KEY`: Deployer wallet private key
- `CELOSCAN_API_KEY`: For contract verification

## Testing Strategy

### Smart Contract Tests
- Hardhat tests in `apps/contracts/test/` using Chai + Hardhat toolbox
- Foundry tests in `apps/contracts/test/` with `.t.sol` extension
- Run both test suites as they may test different aspects

### Frontend Testing
Currently no formal test suite configured. When adding tests:
- Place test files in `apps/web/__tests__/` or colocated with components
- Use standard Next.js testing conventions

## Important Implementation Notes

### Smart Contract Integration
When working with the M2MChat contract:
- Contract ABI is in `apps/web/src/lib/contracts/m2m-abi.ts`
- Configuration constants in `apps/web/src/lib/contracts/m2m-config.ts`
- Price formatting utilities in `apps/web/src/lib/m2m-utils.ts` (handles 18-decimal cUSD conversions)
- Hook for contract interaction: `apps/web/src/hooks/use-m2m-contract.ts`

### XMTP Message Flow
1. User connects wallet via Farcaster frame
2. Wallet converted to XMTP signer via `createXMTPSigner()`
3. XMTP client initialized with signer and encryption key
4. Messages sent/received through XMTP network
5. Message consumption tracked via smart contract checkpoints

### Checkpoint System
The relayer system allows batching on-chain updates:
- Messages tracked off-chain in XMTP
- Periodic checkpoints signed by relayer
- User submits checkpoint to contract to update consumed message count
- Prevents need for transaction per message

### Dual Contract Setup
The project has BOTH Hardhat and Foundry configurations:
- Hardhat: `apps/contracts/hardhat.config.ts`, contracts in `contracts/`
- Foundry: `apps/contracts/foundry.toml`, contracts in `src/`
- Main contract is `M2MChat.sol` (in both locations)
- Also includes example contracts: `Lock.sol`, `Counter.sol`

When deploying, choose one framework consistently. The project appears to favor Foundry for the M2MChat contract (based on recent activity).

## Network Configuration

### Celo Networks
- **Mainnet**: ChainID 42220, RPC: https://forno.celo.org
- **Alfajores Testnet**: ChainID 44787, RPC: https://alfajores-forno.celo-testnet.org
- **Sepolia Testnet**: ChainID 11142220, RPC: https://forno.celo-sepolia.celo-testnet.org

### Block Explorers
- **Mainnet**: https://celoscan.io
- **Alfajores**: https://alfajores.celoscan.io
- **Sepolia**: https://celo-sepolia.blockscout.com

## Wagmi/Viem Integration
The app uses:
- Viem 2.x for Ethereum interactions
- Wagmi 2.x for React hooks
- Custom Farcaster wagmi connector: `@farcaster/miniapp-wagmi-connector`
- Wallet client from wagmi converted to XMTP signer

## File Organization Conventions
- **UI Components**: `apps/web/src/components/ui/` (shadcn/ui)
- **Feature Components**: `apps/web/src/components/` (navbar, providers, etc.)
- **Contexts**: `apps/web/src/contexts/`
- **Hooks**: `apps/web/src/hooks/`
- **Utils/Libs**: `apps/web/src/lib/`
- **Types**: `apps/web/src/types/`
- **API Routes**: `apps/web/src/app/api/`
- **Pages**: `apps/web/src/app/` (Next.js App Router)

## Common Workflows

### Adding a New Feature
1. Update smart contract if needed (in `apps/contracts/src/`)
2. Compile and test contract: `cd apps/contracts && forge build && forge test`
3. Update ABI in `apps/web/src/lib/contracts/m2m-abi.ts` if contract changed
4. Add frontend logic in appropriate hook or context
5. Create/update UI components in `apps/web/src/components/`
6. Test locally with `pnpm dev`
7. Type check with `pnpm type-check`

### Deploying Contract Updates
1. Update contract in `apps/contracts/src/M2MChat.sol`
2. Test: `forge test -vvv`
3. Deploy to testnet first: `pnpm contracts:deploy:alfajores`
4. Verify contract on explorer
5. Update `NEXT_PUBLIC_M2M_CONTRACT_ADDRESS` in web app
6. Update ABI if interface changed
7. Deploy to mainnet when ready: `pnpm contracts:deploy:celo`

### Local Development with Farcaster
See `FARCASTER_SETUP.md` for detailed setup with ngrok for local testing of Farcaster frame features.
