import { Client, type Signer as XMTPSigner } from '@xmtp/browser-sdk'
import { toBytes } from 'viem'

/**
 * Create XMTP-compatible signer from wallet client
 */
export function createXMTPSigner(walletClient: any): XMTPSigner {
  return {
    type: 'EOA',
    getIdentifier: async () => {
      const address = walletClient.account?.address
      if (!address) throw new Error('No address found')
      return address.toLowerCase()
    },
    signMessage: async (message: string | Uint8Array) => {
      const messageBytes =
        typeof message === 'string' ? toBytes(message) : message
      const signature = await walletClient.signMessage({
        message: { raw: messageBytes },
      })
      return toBytes(signature)
    },
  }
}

export interface XMTPClientConfig {
  env: 'dev' | 'production'
}

/**
 * Initialize XMTP client with XMTP signer
 */
export async function createXMTPClient(
  signer: XMTPSigner,
  config: XMTPClientConfig = { env: 'production' }
): Promise<Client> {
  try {
    const client = await Client.create(signer, {
      env: config.env,
    })

    console.log('✅ XMTP client initialized')
    return client
  } catch (error) {
    console.error('❌ Failed to initialize XMTP client:', error)
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
    // Cast addresses to the expected type
    return await client.canMessage(addresses as any)
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
