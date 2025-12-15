'use client'

import { useState, useRef, useEffect } from 'react'
import { Client } from '@xmtp/browser-sdk'
import { useConversation } from '@/hooks/use-xmtp-client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChatGatekeeper } from '@/components/m2m/ChatGatekeeper'
import { useLocalMessageCounter } from '@/hooks/use-checkpoint-trigger'
import { useCheckpointTrigger } from '@/hooks/use-checkpoint-trigger'
import { useAccount } from 'wagmi'
import { useMessagingAccess } from '@/hooks/use-messaging-access'
import { formatUnits } from 'viem'

interface ChatWindowProps {
  client: Client
  peerAddress: string // Can be either Ethereum address (0x...) or inbox ID
}

export function ChatWindow({ client, peerAddress }: ChatWindowProps) {
  const { messages, sendMessage, isLoading, error: conversationError } = useConversation(
    client,
    peerAddress
  )
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [userAddress, setUserAddress] = useState<string>('')

  // M2M Integration: Tracking de mensajes enviados
  const { address: senderAddress } = useAccount()
  const { localConsumed, incrementCount } = useLocalMessageCounter()

  // M2M Integration: Checkpoints automáticos
  const {
    lastCheckpoint,
    messagesSinceCheckpoint,
    isSubmitting: isCheckpointing,
    lastError: checkpointError,
  } = useCheckpointTrigger(
    senderAddress,
    peerAddress as `0x${string}`,
    localConsumed
  )

  // M2M Integration: Validación de acceso a mensajería vía Supabase
  const {
    data: messagingAccess,
    isLoading: isCheckingAccess,
    refetch: refetchAccess,
  } = useMessagingAccess(peerAddress)

  // Get user's inbox ID
  useEffect(() => {
    const getInboxId = async () => {
      const inboxId = client.inboxId || ''
      setUserAddress(inboxId.toLowerCase())
    }
    getInboxId()
  }, [client])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isSending) return

    // M2M Integration: Validar acceso ANTES de enviar mensaje
    if (!messagingAccess?.canMessage) {
      setSendError(
        messagingAccess?.reason === 'mutual_contact'
          ? 'Waiting for mutual contact confirmation...'
          : messagingAccess?.reason === 'no_credits'
          ? 'No message credits available. Purchase a message package first.'
          : 'Cannot send message at this time.'
      )
      setTimeout(() => setSendError(null), 5000)
      return
    }

    setIsSending(true)
    setSendError(null)
    try {
      await sendMessage(input)
      setInput('')

      // M2M Integration: Incrementar contador después de enviar mensaje
      // Esto trigger checkpoints automáticos cada 25 mensajes o 1 hora
      incrementCount()

      // M2M Integration: Actualizar estado de créditos después de enviar
      await refetchAccess()
    } catch (error) {
      console.error('Failed to send message:', error)
      const errorMsg = error instanceof Error ? error.message : 'Failed to send message'
      setSendError(errorMsg)
      // Auto-clear error after 5 seconds
      setTimeout(() => setSendError(null), 5000)
    } finally {
      setIsSending(false)
    }
  }

  // Show error state if conversation failed to load
  if (conversationError) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <p className="text-red-600 mb-2">❌ Failed to load conversation</p>
          <p className="text-sm text-gray-500">{conversationError.message}</p>
          <Button
            onClick={() => window.location.reload()}
            className="mt-4"
            size="sm"
          >
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          <p className="ml-3 text-gray-500">Loading conversation...</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col h-[600px]">
        {/* Header */}
        <div className="p-4 border-b bg-gray-50 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">
                {peerAddress.slice(0, 8)}...{peerAddress.slice(-6)}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                End-to-end encrypted
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs text-gray-600">Online</span>
            </div>
          </div>

          {/* M2M Integration: Messaging Access Status */}
          {messagingAccess && (
            <div className="mt-3 text-xs bg-white p-2 rounded border">
              {messagingAccess.isMutualContact ? (
                <div className="flex items-center gap-2 text-green-600">
                  <span className="text-base">✓</span>
                  <span className="font-medium">Mutual Contact - Free Messaging</span>
                </div>
              ) : messagingAccess.canMessage ? (
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Message Credits:</span>
                    <span className="font-semibold text-blue-600">
                      {messagingAccess.remainingMessages} remaining
                    </span>
                  </div>
                  {messagingAccess.recipientPrice && (
                    <div className="text-gray-500">
                      Price: {formatUnits(messagingAccess.recipientPrice, 18)} cUSD/msg
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-orange-600">
                    <span className="text-base">⚠</span>
                    <span className="font-medium">No Message Credits</span>
                  </div>
                  {messagingAccess.recipientPrice && (
                    <div className="text-gray-600">
                      Purchase credits to message this user ({formatUnits(messagingAccess.recipientPrice, 18)} cUSD/msg)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* M2M Integration: Checkpoint info */}
          {localConsumed > 0 && (
            <div className="mt-2 text-xs text-gray-600 bg-white p-2 rounded border">
              <div className="flex justify-between">
                <span>Messages sent: {localConsumed}</span>
                <span>Last synced: {lastCheckpoint}</span>
              </div>
              {messagesSinceCheckpoint > 0 && (
                <div className="mt-1 flex items-center justify-between">
                  <span>
                    Next sync in: {25 - messagesSinceCheckpoint} messages
                  </span>
                  {isCheckpointing && (
                    <span className="text-blue-600">⏳ Syncing...</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* M2M Integration: Checkpoint error warning */}
          {checkpointError && (
            <div className="mt-2 p-2 rounded bg-yellow-50 border border-yellow-200">
              <p className="text-xs text-yellow-700">
                Sync warning: {checkpointError}
                <br />
                <span className="text-yellow-600">
                  (You can keep chatting, we&apos;ll retry automatically)
                </span>
              </p>
            </div>
          )}
        </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-gray-500 mb-2">No messages yet</p>
              <p className="text-sm text-gray-400">
                Start the conversation by sending a message
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMine = msg.senderInboxId?.toLowerCase() === userAddress
            return (
              <div
                key={i}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    isMine
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-900 border border-gray-200'
                  }`}
                >
                  <p className="text-sm break-words">
                    {typeof msg.content === 'string'
                      ? msg.content
                      : JSON.stringify(msg.content)}
                  </p>
                  <span
                    className={`text-xs mt-1 block ${
                      isMine ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {msg.sentAtNs
                      ? new Date(
                          Number(msg.sentAtNs) / 1000000
                        ).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Just now'}
                  </span>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-4 border-t bg-white rounded-b-lg">
        {/* Send error display */}
        {sendError && (
          <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            ❌ {sendError}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSending}
            maxLength={1000}
          />
          <Button
            type="submit"
            disabled={!input.trim() || isSending || !messagingAccess?.canMessage}
            className="px-6"
          >
            {isSending ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Sending...
              </span>
            ) : !messagingAccess?.canMessage ? (
              'No Credits'
            ) : (
              'Send'
            )}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Messages are encrypted end-to-end with XMTP
        </p>
      </form>
    </Card>
  )
}
