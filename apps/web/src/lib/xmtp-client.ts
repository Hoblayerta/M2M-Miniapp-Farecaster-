import { Client, type Signer as XMTPSigner, type Identifier } from '@xmtp/browser-sdk'
import { toBytes } from 'viem'

/**
 * Convert Ethereum address to XMTP Identifier object
 */
export function addressToIdentifier(address: string): Identifier {
  return {
    identifier: address.toLowerCase(),
    identifierKind: 'Ethereum' as const,
  }
}

/**
 * Create XMTP-compatible signer from wallet client
 */
export function createXMTPSigner(walletClient: any): XMTPSigner {
  console.log('📝 Creating XMTP signer with walletClient:', {
    hasAccount: !!walletClient.account,
    address: walletClient.account?.address,
  })

  return {
    type: 'EOA',
    getIdentifier: async () => {
      const address = walletClient.account?.address
      console.log('🔑 getIdentifier called, address:', address)
      if (!address) throw new Error('No address found')
      return {
        identifier: address.toLowerCase(),
        identifierKind: 'Ethereum' as const,
      }
    },
    signMessage: async (message: string | Uint8Array) => {
      console.log('✍️ signMessage called - requesting wallet signature!')
      console.log('Message type:', typeof message)
      console.log('Message length:', message.length)

      const messageBytes =
        typeof message === 'string' ? toBytes(message) : message

      console.log('📤 Calling walletClient.signMessage...')
      const signature = await walletClient.signMessage({
        message: { raw: messageBytes },
      })
      console.log('✅ Signature received:', signature)

      return toBytes(signature)
    },
  }
}

export interface XMTPClientConfig {
  env: 'dev' | 'production'
}

/**
 * Initialize XMTP client with XMTP signer
 *
 * Uses in-memory storage (dbPath: null) to avoid OPFS issues in iframes
 * Messages won't persist across page reloads, but this is required for
 * iframe compatibility in Farcaster miniapps
 */
export async function createXMTPClient(
  signer: XMTPSigner,
  config: XMTPClientConfig = { env: 'production' }
): Promise<Client> {
  try {
    console.log('🔐 Creating XMTP client with config:', config)
    console.log('📝 This will require a signature from your wallet')
    console.log('⚠️ Using in-memory storage for iframe compatibility')

    const client = await Client.create(signer, {
      env: config.env,
      // CRITICAL: dbPath: null disables persistent storage
      // This avoids OPFS errors in third-party iframes (Farcaster)
      // Trade-off: Messages won't persist across page reloads
      dbPath: null,
    })

    console.log('✅ XMTP client initialized successfully')
    return client
  } catch (error) {
    console.error('❌ Failed to initialize XMTP client:', error)
    console.error('Error details:', error)
    throw error
  }
}

/**
 * Check if wallet addresses can receive XMTP messages
 */
export async function canMessage(
  client: Client,
  addresses: string[]
): Promise<Map<string, boolean>> {
  try {
    // Convert addresses to Identifier objects
    const identifiers = addresses.map(addressToIdentifier)
    return await client.canMessage(identifiers)
  } catch (error) {
    console.error('Error checking canMessage:', error)
    return new Map()
  }
}

/**
 * Validate Ethereum address format
 */
export function isValidEthAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}
