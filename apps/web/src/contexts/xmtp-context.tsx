'use client'

import { createContext, useContext, ReactNode, useState, useEffect } from 'react'
import { Client, type Signer as XMTPSigner } from '@xmtp/browser-sdk'
import { useAccount, useWalletClient, useConnectorClient } from 'wagmi'
import { useXMTPClient } from '@/hooks/use-xmtp-client'
import { createXMTPSigner } from '@/lib/xmtp-client'

interface XMTPContextType {
  client: Client | null
  isInitializing: boolean
  error: Error | null
  isReady: boolean
  address: string | undefined
}

const XMTPContext = createContext<XMTPContextType | undefined>(undefined)

export function XMTPProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, connector } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { data: connectorClient } = useConnectorClient()
  const [signer, setSigner] = useState<XMTPSigner | null>(null)

  // Convert viem walletClient to XMTP Signer
  // Try both useWalletClient and useConnectorClient for Farcaster compatibility
  useEffect(() => {
    const client = walletClient || connectorClient

    console.log('🔍 XMTP Signer Setup:', {
      hasWalletClient: !!walletClient,
      hasConnectorClient: !!connectorClient,
      hasAnyClient: !!client,
      isConnected,
      address,
      connectorId: connector?.id,
      clientAccount: client?.account?.address,
    })

    if (!client || !isConnected || !address) {
      console.warn('⚠️ Cannot create XMTP signer:', {
        walletClient: !!walletClient,
        connectorClient: !!connectorClient,
        isConnected,
        address,
      })
      setSigner(null)
      return
    }

    try {
      console.log('✅ Creating XMTP signer with client')
      const xmtpSigner = createXMTPSigner(client)
      setSigner(xmtpSigner)
      console.log('✅ XMTP signer created successfully')
    } catch (error) {
      console.error('❌ Failed to create XMTP signer:', error)
    }
  }, [walletClient, connectorClient, isConnected, address, connector])

  // Initialize XMTP client
  const { client, isInitializing, error, isReady } = useXMTPClient(signer)

  const value: XMTPContextType = {
    client,
    isInitializing,
    error,
    isReady,
    address,
  }

  return <XMTPContext.Provider value={value}>{children}</XMTPContext.Provider>
}

export function useXMTP() {
  const context = useContext(XMTPContext)
  if (context === undefined) {
    throw new Error('useXMTP must be used within XMTPProvider')
  }
  return context
}
