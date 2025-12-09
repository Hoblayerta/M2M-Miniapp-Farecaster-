'use client'

import { ReactNode, useState, useEffect } from 'react'
import { useMessagePackages } from '@/hooks/use-m2m-contract'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PackagePurchaseModal } from './PackagePurchaseModal'
import { QuickAddContact } from './ContactManager'
import { formatMessageCount, truncateAddress } from '@/lib/m2m-utils'

interface ChatGatekeeperProps {
  receiverAddress: `0x${string}`
  receiverName?: string
  children: ReactNode
  onPermissionChange?: (allowed: boolean, accessType: string) => void
}

/**
 * Componente que verifica permisos antes de permitir acceso al chat
 * - Si no hay permisos: Muestra opciones para agregar contacto o comprar paquete
 * - Si hay permisos pagados: Muestra header con balance restante
 * - Si son contactos mutuos: Muestra chat normal sin restricciones
 */
export function ChatGatekeeper({
  receiverAddress,
  receiverName,
  children,
  onPermissionChange,
}: ChatGatekeeperProps) {
  const { chatPermission, availableMessages, refetchBalance } = useMessagePackages(receiverAddress)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [lastBalance, setLastBalance] = useState<bigint>(0n)

  const displayName = receiverName || truncateAddress(receiverAddress)

  // Real-time balance polling (every 3 seconds when chat is active)
  useEffect(() => {
    if (!chatPermission?.allowed || chatPermission.accessType !== 'paid') {
      return
    }

    // Track balance changes
    if (availableMessages !== lastBalance) {
      setLastBalance(availableMessages)
    }

    // Poll balance every 3 seconds
    const pollInterval = setInterval(() => {
      refetchBalance?.()
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [chatPermission, availableMessages, lastBalance, refetchBalance])

  // Loading state
  if (!chatPermission) {
    return (
      <Card className="p-8 text-center">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
        </div>
      </Card>
    )
  }

  // Notificar cambios de permisos
  if (onPermissionChange) {
    onPermissionChange(chatPermission.allowed, chatPermission.accessType)
  }

  // NO PERMITIDO - Mostrar opciones
  if (!chatPermission.allowed) {
    return (
      <>
        <Card className="p-6">
          <div className="text-center space-y-4">
            <div>
              <h3 className="text-lg font-bold">Cannot Message {displayName}</h3>
              <p className="text-sm text-gray-600 mt-1">
                You need permission to send messages to this user
              </p>
            </div>

            <div className="flex flex-col gap-3 max-w-sm mx-auto">
              {/* Opción 1: Agregar como contacto */}
              <div className="p-4 rounded-lg border-2 border-gray-200">
                <h4 className="font-medium mb-2">Add as Contact (Free)</h4>
                <p className="text-xs text-gray-600 mb-3">
                  If they add you back, you can message each other for free
                </p>
                <QuickAddContact
                  contactAddress={receiverAddress}
                  onSuccess={() => {
                    // Refrescar permisos se hace automáticamente
                  }}
                />
              </div>

              {/* Opción 2: Comprar paquete */}
              <div className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50">
                <h4 className="font-medium mb-2">Buy Message Package</h4>
                <p className="text-xs text-gray-600 mb-3">
                  Purchase messages to chat immediately
                </p>
                <Button onClick={() => setShowPurchaseModal(true)} className="w-full">
                  View Packages
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Modal de compra */}
        {showPurchaseModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="relative max-w-lg w-full">
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="absolute -top-4 -right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
              <PackagePurchaseModal
                receiverAddress={receiverAddress}
                receiverName={receiverName}
                onSuccess={() => {
                  setShowPurchaseModal(false)
                  // Permisos se refrescan automáticamente
                }}
                onClose={() => setShowPurchaseModal(false)}
              />
            </div>
          </div>
        )}
      </>
    )
  }

  // CONTACTOS MUTUOS - Chat sin restricciones
  if (chatPermission.accessType === 'mutual') {
    return (
      <div className="space-y-2">
        {/* Header de contacto mutuo */}
        <div className="flex items-center justify-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span>Mutual contact • Free unlimited messaging</span>
        </div>

        {/* Chat */}
        {children}
      </div>
    )
  }

  // PAQUETE PAGADO - Mostrar balance
  if (chatPermission.accessType === 'paid') {
    const messagesLeft = Number(availableMessages)
    const isLow = messagesLeft <= 5
    const isEmpty = messagesLeft === 0

    return (
      <div className="space-y-2">
        {/* Header con balance */}
        <div
          className={`flex items-center justify-between px-4 py-2 rounded-lg ${
            isEmpty
              ? 'bg-red-50 border border-red-200'
              : isLow
                ? 'bg-yellow-50 border border-yellow-200'
                : 'bg-blue-50 border border-blue-200'
          }`}
        >
          <div className="text-sm">
            <span className="font-medium">
              {formatMessageCount(availableMessages)} messages remaining
            </span>
            {isLow && !isEmpty && (
              <span className="text-xs text-yellow-700 ml-2">Running low</span>
            )}
            {isEmpty && <span className="text-xs text-red-700 ml-2">No messages left</span>}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowPurchaseModal(true)}
            className="text-xs"
          >
            Buy More
          </Button>
        </div>

        {/* Chat (bloqueado si no hay mensajes) */}
        {isEmpty ? (
          <Card className="p-8 text-center">
            <p className="text-gray-600 mb-4">
              You&apos;ve used all your messages to {displayName}
            </p>
            <Button onClick={() => setShowPurchaseModal(true)}>Buy More Messages</Button>
          </Card>
        ) : (
          children
        )}

        {/* Modal de compra */}
        {showPurchaseModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="relative max-w-lg w-full">
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="absolute -top-4 -right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
              <PackagePurchaseModal
                receiverAddress={receiverAddress}
                receiverName={receiverName}
                onSuccess={() => {
                  setShowPurchaseModal(false)
                }}
                onClose={() => setShowPurchaseModal(false)}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  // Fallback (no debería llegar aquí)
  return <div className="p-4 text-center text-gray-600">Unable to load chat permissions</div>
}
