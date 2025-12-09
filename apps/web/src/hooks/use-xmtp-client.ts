'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Client, ConsentState } from '@xmtp/browser-sdk'
import type { Signer as XMTPSigner } from '@xmtp/browser-sdk'
import { createXMTPClient, addressToIdentifier } from '@/lib/xmtp-client'
import { env } from '@/lib/env'

/**
 * Hook to manage XMTP client lifecycle with proper initialization
 */
export function useXMTPClient(signer: XMTPSigner | null) {
  const [client, setClient] = useState<Client | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const initAttemptRef = useRef(0)
  const MAX_RETRIES = 3

  useEffect(() => {
    if (!signer) {
      setClient(null)
      setError(null)
      return
    }

    let mounted = true
    initAttemptRef.current = 0

    const initClientWithRetry = async () => {
      setIsInitializing(true)
      setError(null)

      while (initAttemptRef.current < MAX_RETRIES && mounted) {
        try {
          console.log(`🔄 Initializing XMTP client (attempt ${initAttemptRef.current + 1}/${MAX_RETRIES})...`)

          const xmtpClient = await createXMTPClient(signer, {
            env: env.NEXT_PUBLIC_XMTP_ENV,
          })

          console.log('✅ XMTP client created successfully')

          if (mounted) {
            setClient(xmtpClient)
            setError(null)
            setIsInitializing(false)
          }
          return // Success, exit retry loop
        } catch (err) {
          initAttemptRef.current++
          const error = err instanceof Error ? err : new Error('Unknown error')

          console.error(`❌ XMTP initialization error (attempt ${initAttemptRef.current}):`, error)

          if (initAttemptRef.current >= MAX_RETRIES) {
            if (mounted) {
              setError(error)
            }
          } else {
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, initAttemptRef.current - 1)))
          }
        }
      }

      if (mounted) {
        setIsInitializing(false)
      }
    }

    initClientWithRetry()

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
 * Hook to manage a single DM conversation with optimized sync
 * @param peerIdentifier Can be either an Ethereum address (0x...) or an inbox ID
 */
export function useConversation(
  client: Client | null,
  peerIdentifier: string
) {
  const [conversation, setConversation] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const syncIntervalRef = useRef<NodeJS.Timeout>()
  const isMountedRef = useRef(true)

  // Initialize conversation (non-blocking background sync)
  useEffect(() => {
    if (!client || !peerIdentifier) {
      setIsLoading(false)
      return
    }

    isMountedRef.current = true
    let dm: any = null

    const init = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Check if it's an Ethereum address or inbox ID
        const isEthAddress = peerIdentifier.startsWith('0x')

        console.log('🔄 Initializing conversation with:', {
          peerIdentifier,
          isEthAddress,
        })

        let inboxId: string

        if (isEthAddress) {
          // Convert Ethereum address to inbox ID
          const identifier = addressToIdentifier(peerIdentifier)
          console.log('🔍 Looking up inbox ID for address:', identifier)

          const foundInboxId = await client.findInboxIdByIdentifier(identifier)
          console.log('✅ Found inbox ID:', foundInboxId)

          if (!foundInboxId) {
            throw new Error('Could not find inbox ID for address')
          }
          inboxId = foundInboxId
        } else {
          // Already an inbox ID
          console.log('📍 Using inbox ID directly:', peerIdentifier)
          inboxId = peerIdentifier
        }

        // Get or create DM using inbox ID
        console.log('📞 Creating DM with inbox ID:', inboxId)
        dm = await client.conversations.newDm(inboxId)
        console.log('✅ DM created:', dm.id)

        if (!isMountedRef.current) return

        setConversation(dm)

        // Start background sync (non-blocking)
        console.log('🔄 Starting background message sync...')
        backgroundSyncMessages(dm)

      } catch (err) {
        console.error('❌ Failed to initialize conversation:', err)
        if (isMountedRef.current) {
          setError(err instanceof Error ? err : new Error('Failed to initialize conversation'))
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false)
        }
      }
    }

    // Background sync function (doesn't block UI)
    const backgroundSyncMessages = async (conversation: any) => {
      try {
        // Initial sync
        await conversation.sync()
        const msgs = await conversation.messages()
        console.log('✅ Loaded', msgs.length, 'messages')

        if (isMountedRef.current) {
          setMessages(msgs)
        }

        // Set up periodic sync (every 5 seconds)
        syncIntervalRef.current = setInterval(async () => {
          if (!isMountedRef.current) return

          try {
            await conversation.sync()
            const updatedMsgs = await conversation.messages()

            if (isMountedRef.current) {
              setMessages(updatedMsgs)
            }
          } catch (err) {
            console.warn('Background sync warning:', err)
            // Don't throw - let it retry on next interval
          }
        }, 5000)
      } catch (err) {
        console.error('❌ Background sync failed:', err)
      }
    }

    init()

    return () => {
      isMountedRef.current = false
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [client, peerIdentifier])

  // Stream new messages in real-time
  useEffect(() => {
    if (!conversation || !isMountedRef.current) return

    console.log('📡 Starting message stream...')

    const streamCloser = conversation.stream((error: Error | null, message: any) => {
      if (error) {
        console.error('❌ Stream error:', error)
        return
      }
      if (message && isMountedRef.current) {
        console.log('📨 New message received:', message)
        setMessages((prev) => {
          // Check if message already exists to avoid duplicates
          const exists = prev.some((m) => m.id === message.id)
          if (exists) return prev
          return [...prev, message].sort((a, b) => Number(a.sentAtNs) - Number(b.sentAtNs))
        })
      }
    })

    console.log('✅ Message stream started')

    return () => {
      console.log('🛑 Closing message stream')
      streamCloser?.close?.()
    }
  }, [conversation])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversation) throw new Error('No conversation initialized')

      console.log('📤 Sending message:', content)

      try {
        // Send the message
        const messageId = await conversation.send(content)
        console.log('✅ Message sent successfully, ID:', messageId)

        // Trigger immediate sync to get the sent message
        await conversation.sync()
        const updatedMessages = await conversation.messages()
        if (isMountedRef.current) {
          setMessages(updatedMessages)
        }
      } catch (error) {
        console.error('❌ Failed to send message:', error)
        throw error
      }
    },
    [conversation]
  )

  return {
    conversation,
    messages,
    sendMessage,
    isLoading,
    error,
  }
}

/**
 * Hook to list all DM conversations with proper consent filtering
 */
export function useConversations(client: Client | null) {
  const [conversations, setConversations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const syncIntervalRef = useRef<NodeJS.Timeout>()
  const isMountedRef = useRef(true)

  useEffect(() => {
    if (!client) {
      setConversations([])
      return
    }

    isMountedRef.current = true

    const loadConversations = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Use syncAll with consent filtering as per XMTP docs
        console.log('🔄 Syncing all conversations with consent filter...')
        await client.conversations.syncAll([ConsentState.Allowed])

        // List only allowed DMs
        const convs = await client.conversations.listDms({
          consentStates: [ConsentState.Allowed],
        })

        console.log('✅ Loaded', convs.length, 'allowed conversations')

        if (isMountedRef.current) {
          setConversations(convs)
        }

        // Set up periodic sync (every 10 seconds)
        syncIntervalRef.current = setInterval(async () => {
          if (!isMountedRef.current) return

          try {
            await client.conversations.syncAll([ConsentState.Allowed])
            const updatedConvs = await client.conversations.listDms({
              consentStates: [ConsentState.Allowed],
            })

            if (isMountedRef.current) {
              setConversations(updatedConvs)
            }
          } catch (err) {
            console.warn('Conversations sync warning:', err)
          }
        }, 10000)

      } catch (err) {
        console.error('Error loading conversations:', err)
        if (isMountedRef.current) {
          setError(err instanceof Error ? err : new Error('Failed to load conversations'))
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false)
        }
      }
    }

    loadConversations()

    return () => {
      isMountedRef.current = false
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [client])

  return {
    conversations,
    isLoading,
    error,
  }
}
