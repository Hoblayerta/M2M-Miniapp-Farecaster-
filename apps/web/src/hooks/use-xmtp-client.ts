'use client'

import { useState, useEffect, useCallback } from 'react'
import { Client, type Dm } from '@xmtp/browser-sdk'
import type { Signer as XMTPSigner } from '@xmtp/browser-sdk'
import { createXMTPClient, addressToIdentifier } from '@/lib/xmtp-client'
import { env } from '@/lib/env'

/**
 * Hook to manage XMTP client lifecycle
 */
export function useXMTPClient(signer: XMTPSigner | null) {
  const [client, setClient] = useState<Client | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!signer) {
      setClient(null)
      return
    }

    let mounted = true

    const initClient = async () => {
      setIsInitializing(true)
      setError(null)

      try {
        console.log('🔄 Initializing XMTP client...')
        const xmtpClient = await createXMTPClient(signer, {
          env: env.NEXT_PUBLIC_XMTP_ENV,
        })

        console.log('✅ XMTP client created successfully')
        if (mounted) {
          setClient(xmtpClient)
        }
      } catch (err) {
        console.error('❌ XMTP initialization error:', err)
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'))
        }
      } finally {
        if (mounted) {
          setIsInitializing(false)
        }
      }
    }

    initClient()

    return () => {
      mounted = false
    }
  }, [signer])

  return {
    client,
    isInitializing,
    error,
    isReady: !isInitializing && !!client,
  }
}

/**
 * Hook to manage a single DM conversation
 */
export function useConversation(client: Client | null, peerAddress: string) {
  const [conversation, setConversation] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Initialize conversation
  useEffect(() => {
    if (!client || !peerAddress) {
      setIsLoading(false)
      return
    }

    const init = async () => {
      setIsLoading(true)
      try {
        console.log('🔄 Initializing conversation with address:', peerAddress)

        // Sync conversations first
        await client.conversations.sync()
        console.log('✅ Conversations synced')

        // Convert Ethereum address to Identifier
        const identifier = addressToIdentifier(peerAddress)
        console.log('🔍 Looking up inbox ID for identifier:', identifier)

        // Find inbox ID from address
        const inboxId = await client.findInboxIdByIdentifier(identifier)
        console.log('✅ Found inbox ID:', inboxId)

        if (!inboxId) {
          throw new Error('Could not find inbox ID for address')
        }

        // Get or create DM using inbox ID
        console.log('📞 Creating DM with inbox ID:', inboxId)
        const dm = await client.conversations.newDm(inboxId)
        console.log('✅ DM created:', dm)

        setConversation(dm)

        // Load message history
        console.log('📜 Loading message history...')
        await dm.sync()
        const msgs = await dm.messages()
        console.log('✅ Loaded', msgs.length, 'messages')
        setMessages(msgs)
      } catch (error) {
        console.error('❌ Failed to initialize conversation:', error)
        console.error('Error details:', error)
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [client, peerAddress])

  // Stream new messages
  useEffect(() => {
    if (!conversation) return

    let active = true

    const streamMessages = async () => {
      try {
        const stream = await conversation.stream()
        for await (const message of stream) {
          if (!active) break
          setMessages((prev) => [...prev, message])
        }
      } catch (error) {
        console.error('Error streaming messages:', error)
      }
    }

    streamMessages()

    return () => {
      active = false
    }
  }, [conversation])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversation) throw new Error('No conversation initialized')

      await conversation.send(content)
    },
    [conversation]
  )

  return {
    conversation,
    messages,
    sendMessage,
    isLoading,
  }
}

/**
 * Hook to list all DM conversations
 */
export function useConversations(client: Client | null) {
  const [conversations, setConversations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!client) {
      setConversations([])
      return
    }

    const loadConversations = async () => {
      setIsLoading(true)
      try {
        await client.conversations.sync()
        const convs = await client.conversations.listDms()
        setConversations(convs)
      } catch (error) {
        console.error('Error loading conversations:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadConversations()
  }, [client])

  return {
    conversations,
    isLoading,
  }
}
