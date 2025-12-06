'use client'

import { useState } from 'react'
import { useXMTP } from '@/contexts/xmtp-context'
import { ConversationList } from '@/components/xmtp/ConversationList'
import { ChatWindow } from '@/components/xmtp/ChatWindow'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { isValidEthAddress, canMessage } from '@/lib/xmtp-client'

export default function ChatPage() {
  const { client, isReady, isInitializing, address } = useXMTP()
  const [activeChat, setActiveChat] = useState<string | null>(null)
  const [newChatAddress, setNewChatAddress] = useState('')
  const [isChecking, setIsChecking] = useState(false)

  const startNewChat = async () => {
    if (!client) return

    if (!isValidEthAddress(newChatAddress)) {
      alert('Invalid Ethereum address format')
      return
    }

    if (newChatAddress.toLowerCase() === address?.toLowerCase()) {
      alert('You cannot message yourself')
      return
    }

    setIsChecking(true)
    try {
      // Check if recipient can receive XMTP messages
      const canMsgMap = await canMessage(client, [newChatAddress])
      const canMsg = canMsgMap.get(newChatAddress.toLowerCase())

      if (!canMsg) {
        alert(
          'This address cannot receive XMTP messages yet. They need to enable XMTP first.'
        )
        setIsChecking(false)
        return
      }

      setActiveChat(newChatAddress)
      setNewChatAddress('')
    } catch (error) {
      console.error('Error checking address:', error)
      alert('Failed to verify address. Please try again.')
    } finally {
      setIsChecking(false)
    }
  }

  if (!isReady) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card className="p-8 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <h1 className="text-3xl font-bold">Secure Messaging</h1>
            <p className="text-gray-600">
              {isInitializing
                ? 'Initializing XMTP client...'
                : !address
                ? 'Please connect your wallet to start messaging'
                : 'Setting up your secure messaging...'}
            </p>
            {isInitializing && (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
              </div>
            )}
            {!address && (
              <p className="text-sm text-gray-500">
                You need to connect your wallet to use XMTP messaging
              </p>
            )}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Anti-Spam Messages</h1>
        <p className="text-gray-600">
          End-to-end encrypted messaging powered by XMTP
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Sidebar */}
        <div className="md:col-span-1 space-y-4">
          {/* User Info Card */}
          <Card className="p-4">
            <h2 className="font-semibold mb-2 text-sm">Your Wallet</h2>
            <div className="bg-gray-100 p-3 rounded">
              <p className="text-xs font-mono break-all text-gray-700">
                {address}
              </p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs text-gray-600">XMTP Ready</span>
            </div>
          </Card>

          {/* New Chat Card */}
          <Card className="p-4">
            <h2 className="font-semibold mb-3 text-sm">Start New Chat</h2>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="0x..."
                value={newChatAddress}
                onChange={(e) => setNewChatAddress(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isChecking}
              />
              <Button
                onClick={startNewChat}
                disabled={!newChatAddress || isChecking}
                className="w-full"
                size="sm"
              >
                {isChecking ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Checking...
                  </span>
                ) : (
                  'Start Chat'
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Enter a wallet address to start messaging
            </p>
          </Card>

          {/* Conversations List */}
          <Card className="p-4">
            <h2 className="font-semibold mb-3 text-sm">Conversations</h2>
            {client && (
              <ConversationList
                client={client}
                onSelectConversation={setActiveChat}
                activeAddress={activeChat}
              />
            )}
          </Card>
        </div>

        {/* Chat Area */}
        <div className="md:col-span-2">
          {activeChat && client ? (
            <ChatWindow client={client} peerAddress={activeChat} />
          ) : (
            <Card className="p-12 h-[600px] flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="mb-4 text-6xl">💬</div>
                <h3 className="text-xl font-semibold mb-2">No chat selected</h3>
                <p className="text-gray-500 mb-4">
                  Select a conversation from your list or start a new chat with
                  a wallet address
                </p>
                <div className="text-sm text-gray-400">
                  <p>All messages are encrypted end-to-end</p>
                  <p className="mt-1">Powered by XMTP protocol</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
