'use client'

import { createContext, useContext, ReactNode, useState, useEffect } from 'react'
import { Client, type Signer as XMTPSigner } from '@xmtp/browser-sdk'
import { useAccount, useWalletClient } from 'wagmi'
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
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [signer, setSigner] = useState<XMTPSigner | null>(null)

  // Convert viem walletClient to XMTP Signer
  useEffect(() => {
    console.log('🔍 XMTP Signer Setup:', {
      hasWalletClient: !!walletClient,
      isConnected,
      address,
      walletClientAccount: walletClient?.account?.address,
    })

    if (!walletClient || !isConnected) {
      console.warn('⚠️ Cannot create XMTP signer:', {
        walletClient: !!walletClient,
        isConnected,
      })
      setSigner(null)
      return
    }

    try {
      console.log('✅ Creating XMTP signer with wallet client')
      const xmtpSigner = createXMTPSigner(walletClient)
      setSigner(xmtpSigner)
      console.log('✅ XMTP signer created successfully')
    } catch (error) {
      console.error('❌ Failed to create XMTP signer:', error)
    }
  }, [walletClient, isConnected, address])

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
