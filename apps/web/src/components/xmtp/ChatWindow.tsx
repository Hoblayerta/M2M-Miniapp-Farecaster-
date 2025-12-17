'use client'

import { useState, useRef, useEffect } from 'react'
import { Client } from '@xmtp/browser-sdk'
import { useConversation } from '@/hooks/use-xmtp-client'
import { useMessagingAccess } from '@/hooks/use-messaging-access'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ChatWindowProps {
  client: Client
  peerAddress: string // Can be either Ethereum address (0x...) or inbox ID
}

export function ChatWindow({ client, peerAddress }: ChatWindowProps) {
  const { messages, sendMessage, isLoading } = useConversation(
    client,
    peerAddress
  )
  const {
    data: messagingAccess,
    isLoading: isCheckingAccess,
    refetch: refetchAccess,
  } = useMessagingAccess(peerAddress)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [userAddress, setUserAddress] = useState<string>('')

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

    // Validate messaging access
    if (!messagingAccess?.canMessage) {
      setSendError(
        messagingAccess?.reason === 'no_credits'
          ? 'No message credits available. Purchase a message package first.'
          : 'Cannot send message at this time.'
      )
      return
    }

    setSendError(null)
    setIsSending(true)
    try {
      await sendMessage(input)
      setInput('')
      // Refresh access after sending to update credit count
      await refetchAccess()
    } catch (error) {
      console.error('Failed to send message:', error)
      setSendError('Failed to send message. Please try again.')
    } finally {
      setIsSending(false)
    }
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
        {/* Messaging Access Status */}
        {isCheckingAccess ? (
          <div className="mb-3 text-xs text-gray-500">Checking access...</div>
        ) : messagingAccess?.isMutualContact ? (
          <div className="mb-3 flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-2 rounded">
            <span>✓ Mutual Contact - Free Messaging</span>
          </div>
        ) : messagingAccess?.canMessage ? (
          <div className="mb-3 flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded">
            <span>Message Credits: {messagingAccess.remainingMessages} remaining</span>
          </div>
        ) : (
          <div className="mb-3 flex items-center gap-2 text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded">
            <span>⚠ No Message Credits - Purchase required</span>
          </div>
        )}

        {/* Error Display */}
        {sendError && (
          <div className="mb-3 text-xs text-red-600 bg-red-50 px-3 py-2 rounded">
            {sendError}
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
            disabled={!input.trim() || isSending}
            className="px-6"
          >
            {isSending ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Sending...
              </span>
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
