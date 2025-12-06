'use client'

import { Client, type Dm } from '@xmtp/browser-sdk'
import { useConversations } from '@/hooks/use-xmtp-client'
import { Card } from '@/components/ui/card'

interface ConversationListProps {
  client: Client
  onSelectConversation: (peerAddress: string) => void
  activeAddress?: string | null
}

export function ConversationList({
  client,
  onSelectConversation,
  activeAddress,
}: ConversationListProps) {
  const { conversations, isLoading } = useConversations(client)

  if (isLoading) {
    return (
      <Card className="p-4">
        <p className="text-sm text-gray-500">Loading conversations...</p>
      </Card>
    )
  }

  if (conversations.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-gray-500 text-center">No conversations yet</p>
        <p className="text-xs text-gray-400 text-center mt-2">
          Start a new chat to begin messaging
        </p>
      </Card>
    )
  }

  return (
    <div className="max-h-[400px] overflow-y-auto">
      <div className="space-y-2">
        {conversations.map((dm: any) => {
          const peerInboxId = typeof dm.peerInboxId === 'function' ? '' : dm.peerInboxId
          const isActive = peerInboxId === activeAddress

          return (
            <Card
              key={dm.id}
              className={`p-3 cursor-pointer transition-colors hover:bg-gray-50 ${
                isActive ? 'bg-blue-50 border-blue-300' : ''
              }`}
              onClick={() => onSelectConversation(peerInboxId)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {peerInboxId
                      ? `${peerInboxId.slice(0, 8)}...${peerInboxId.slice(-6)}`
                      : 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {dm.createdAtNs
                      ? new Date(Number(dm.createdAtNs) / 1000000).toLocaleDateString()
                      : 'Recent'}
                  </p>
                </div>
                {isActive && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full ml-2" />
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
