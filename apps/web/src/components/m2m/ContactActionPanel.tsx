'use client'

import { useState } from 'react'
import { useContacts } from '@/hooks/use-m2m-contract'
import { useMessagingAccess } from '@/hooks/use-messaging-access'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PackagePurchaseModal } from './PackagePurchaseModal'
import { truncateAddress } from '@/lib/m2m-utils'

interface ContactActionPanelProps {
  contactAddress: `0x${string}`
  contactName?: string
  onChatStart?: () => void
  compact?: boolean
}

/**
 * Panel que muestra el estado del contacto y acciones disponibles:
 * - 🟢 Mutual Contact: Chat gratis
 * - 🟡 Pending: Esperando que te agreguen
 * - ⚪ Not Added: Agregar o comprar paquete
 */
export function ContactActionPanel({
  contactAddress,
  contactName,
  onChatStart,
  compact = false,
}: ContactActionPanelProps) {
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  
  const {
    contactStatus,
    addContact,
    isPending: isAddingContact,
    isConfirming: isConfirmingContact,
  } = useContacts(contactAddress)

  const {
    data: messagingAccess,
    isLoading: isCheckingAccess,
  } = useMessagingAccess(contactAddress)

  const displayName = contactName || truncateAddress(contactAddress)
  const isLoading = isAddingContact || isConfirmingContact

  // Loading state
  if (isCheckingAccess) {
    return (
      <Card className={compact ? 'p-3' : 'p-4'}>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
          <span>Checking contact status...</span>
        </div>
      </Card>
    )
  }

  // 🟢 MUTUAL CONTACT - Free messaging
  if (messagingAccess?.isMutualContact) {
    return (
      <Card className={compact ? 'p-3' : 'p-4'}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full" />
            <div>
              <p className="font-medium text-sm text-green-700">Mutual Contact</p>
              <p className="text-xs text-gray-500">Free unlimited messaging with {displayName}</p>
            </div>
          </div>
          {onChatStart && (
            <Button onClick={onChatStart} size="sm">
              Start Chat
            </Button>
          )}
        </div>
      </Card>
    )
  }

  // 🟡 PENDING - You added them, waiting for them to add back
  if (contactStatus.hasAdded && !contactStatus.isMutual) {
    return (
      <>
        <Card className={compact ? 'p-3' : 'p-4'}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-yellow-400 rounded-full" />
              <div>
                <p className="font-medium text-sm text-yellow-700">Pending Contact</p>
                <p className="text-xs text-gray-500">
                  Waiting for {displayName} to add you back
                </p>
              </div>
            </div>

            {/* Check if user has paid credits */}
            {messagingAccess?.canMessage && messagingAccess.remainingMessages > 0 ? (
              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-xs text-blue-600">
                  💰 {messagingAccess.remainingMessages} message credits available
                </p>
                {onChatStart && (
                  <Button onClick={onChatStart} size="sm" variant="outline">
                    Start Chat
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  onClick={() => setShowPurchaseModal(true)}
                  size="sm"
                  className="flex-1"
                >
                  Buy Message Package
                </Button>
                {onChatStart && (
                  <Button onClick={onChatStart} size="sm" variant="outline">
                    Wait
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>

        {showPurchaseModal && (
          <PackagePurchaseModal
            receiverAddress={contactAddress}
            receiverName={contactName}
            onSuccess={() => setShowPurchaseModal(false)}
            onClose={() => setShowPurchaseModal(false)}
          />
        )}
      </>
    )
  }

  // ⚪ NOT ADDED - Need to add contact or buy package
  return (
    <>
      <Card className={compact ? 'p-3' : 'p-4'}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-gray-300 rounded-full" />
            <div>
              <p className="font-medium text-sm text-gray-700">Not a Contact</p>
              <p className="text-xs text-gray-500">
                Add {displayName} as contact for free messaging
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
            <Button
              onClick={addContact}
              disabled={isLoading}
              size="sm"
              variant="outline"
              className="flex-1"
            >
              {isLoading ? (
                <span className="flex items-center gap-1">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                  Adding...
                </span>
              ) : (
                '👋 Add Contact'
              )}
            </Button>
            <Button
              onClick={() => setShowPurchaseModal(true)}
              size="sm"
              className="flex-1"
            >
              💰 Buy Package
            </Button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Adding is free. If they add you back, messaging is free forever.
          </p>
        </div>
      </Card>

      {showPurchaseModal && (
        <PackagePurchaseModal
          receiverAddress={contactAddress}
          receiverName={contactName}
          onSuccess={() => setShowPurchaseModal(false)}
          onClose={() => setShowPurchaseModal(false)}
        />
      )}
    </>
  )
}

/**
 * Badge compacto para mostrar en listas
 */
export function ContactStatusBadge({
  contactAddress,
}: {
  contactAddress: `0x${string}`
}) {
  const { data: messagingAccess, isLoading } = useMessagingAccess(contactAddress)
  const { contactStatus } = useContacts(contactAddress)

  if (isLoading) {
    return <span className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" />
  }

  // Mutual contact
  if (messagingAccess?.isMutualContact) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700">
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
        Free
      </span>
    )
  }

  // Pending (you added them)
  if (contactStatus.hasAdded && !contactStatus.isMutual) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">
        <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
        Pending
      </span>
    )
  }

  // Has paid credits
  if (messagingAccess?.canMessage && messagingAccess.remainingMessages > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
        💰 {messagingAccess.remainingMessages}
      </span>
    )
  }

  // No access
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500">
      <span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
      No access
    </span>
  )
}
