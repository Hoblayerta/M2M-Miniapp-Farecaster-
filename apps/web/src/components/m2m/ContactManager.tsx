'use client'

import { useContacts } from '@/hooks/use-m2m-contract'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { truncateAddress } from '@/lib/m2m-utils'
import { useState } from 'react'

interface ContactManagerProps {
  contactAddress: `0x${string}`
  contactName?: string
  onContactStatusChange?: (isMutual: boolean) => void
}

export function ContactManager({
  contactAddress,
  contactName,
  onContactStatusChange,
}: ContactManagerProps) {
  const {
    contactStatus,
    addContact,
    removeContact,
    isPending,
    isConfirming,
    isSuccess,
    error,
  } = useContacts(contactAddress)

  const [showSuccess, setShowSuccess] = useState(false)

  // Mostrar mensaje de éxito temporalmente
  if (isSuccess && !showSuccess) {
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)

    // Notificar cambio de estado
    onContactStatusChange?.(contactStatus.isMutual)
  }

  const displayName = contactName || truncateAddress(contactAddress)
  const isLoading = isPending || isConfirming

  return (
    <Card className="p-4">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">{displayName}</h3>
            <p className="text-xs text-gray-500">{truncateAddress(contactAddress)}</p>
          </div>

          {/* Status Badge */}
          <div>
            {contactStatus.isMutual && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Mutual Contact
              </span>
            )}
            {!contactStatus.isMutual && contactStatus.hasAdded && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Pending
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {!contactStatus.hasAdded && (
            <Button onClick={addContact} disabled={isLoading} className="flex-1" size="sm">
              {isLoading ? 'Adding...' : 'Add Contact'}
            </Button>
          )}

          {contactStatus.hasAdded && !contactStatus.isMutual && (
            <Button
              onClick={removeContact}
              disabled={isLoading}
              variant="outline"
              className="flex-1"
              size="sm"
            >
              {isLoading ? 'Removing...' : 'Remove'}
            </Button>
          )}

          {contactStatus.isMutual && (
            <Button
              onClick={removeContact}
              disabled={isLoading}
              variant="outline"
              className="flex-1"
              size="sm"
            >
              {isLoading ? 'Removing...' : 'Remove Contact'}
            </Button>
          )}
        </div>

        {/* Status Messages */}
        {contactStatus.hasAdded && !contactStatus.isMutual && (
          <p className="text-xs text-gray-600">
            Waiting for {displayName} to add you back for free messaging
          </p>
        )}

        {contactStatus.isMutual && (
          <p className="text-xs text-green-600">Unlimited free messaging enabled</p>
        )}

        {/* Success Message */}
        {showSuccess && (
          <div className="p-2 rounded bg-green-50 border border-green-200">
            <p className="text-xs text-green-700">Contact updated successfully!</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-2 rounded bg-red-50 border border-red-200">
            <p className="text-xs text-red-700">
              Error: {error.message || 'Transaction failed'}
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}

/**
 * Componente simplificado para mostrar solo el botón de agregar contacto
 */
export function QuickAddContact({
  contactAddress,
  onSuccess,
}: {
  contactAddress: `0x${string}`
  onSuccess?: () => void
}) {
  const { contactStatus, addContact, isPending, isConfirming, isSuccess } =
    useContacts(contactAddress)

  if (isSuccess && onSuccess) {
    onSuccess()
  }

  if (contactStatus.hasAdded) {
    return (
      <div className="inline-flex items-center gap-2 text-sm text-gray-600">
        <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
        Contact request sent
      </div>
    )
  }

  if (contactStatus.isMutual) {
    return (
      <div className="inline-flex items-center gap-2 text-sm text-green-600">
        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
        Mutual contact
      </div>
    )
  }

  const isLoading = isPending || isConfirming

  return (
    <Button onClick={addContact} disabled={isLoading} size="sm" variant="outline">
      {isLoading ? 'Adding...' : 'Add as Contact'}
    </Button>
  )
}
