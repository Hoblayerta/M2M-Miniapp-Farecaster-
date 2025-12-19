'use client'

import { useState, useEffect } from 'react'
import { useMessagePricing, useMessagePackages, useCUSDApproval } from '@/hooks/use-m2m-contract'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PACKAGE_OPTIONS } from '@/lib/contracts/m2m-config'
import {
  formatPriceFromContract,
  calculatePackageBreakdown,
  truncateAddress,
} from '@/lib/m2m-utils'

interface PackagePurchaseModalProps {
  receiverAddress: `0x${string}`
  receiverName?: string
  onSuccess?: () => void
  onClose?: () => void
}

export function PackagePurchaseModal({
  receiverAddress,
  receiverName,
  onSuccess,
  onClose,
}: PackagePurchaseModalProps) {
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null)
  const [step, setStep] = useState<'select' | 'approve' | 'buy' | 'success'>('select')

  // Obtener precio del receptor
  const { pricePerMessage, isPriceSet } = useMessagePricing(receiverAddress)

  // Hooks para compra de paquete
  const {
    buyPackage,
    isPending: isBuyPending,
    isConfirming: isBuyConfirming,
    isSuccess: isBuySuccess,
    error: buyError,
  } = useMessagePackages(receiverAddress)

  // Calcular cantidad requerida para approval
  const requiredAmount =
    selectedPackage && isPriceSet
      ? pricePerMessage * BigInt(selectedPackage)
      : undefined

  // Hook para aprobación de cUSD
  const {
    approvalStatus,
    balance,
    approve,
    isPending: isApprovePending,
    isConfirming: isApproveConfirming,
    isSuccess: isApproveSuccess,
    error: approveError,
  } = useCUSDApproval(requiredAmount)

  // Actualizar paso cuando se complete la aprobación
  useEffect(() => {
    if (isApproveSuccess && step === 'approve') {
      setStep('buy')
    }
  }, [isApproveSuccess, step])

  // Actualizar paso cuando se complete la compra
  useEffect(() => {
    if (isBuySuccess) {
      setStep('success')
      setTimeout(() => {
        onSuccess?.()
      }, 2000)
    }
  }, [isBuySuccess, onSuccess])

  const displayName = receiverName || truncateAddress(receiverAddress)

  // Si no hay precio establecido
  if (!isPriceSet || pricePerMessage === 0n) {
    return (
      <div className="p-4">
        <Card className="p-6 text-center">
          <p className="text-gray-600">
            {displayName} hasn&apos;t set a message price yet. You cannot buy a package right now.
          </p>
          {onClose && (
            <Button onClick={onClose} className="mt-4" variant="outline">
              Close
            </Button>
          )}
        </Card>
      </div>
    )
  }

  const priceFormatted = formatPriceFromContract(pricePerMessage)

  // Calcular breakdown si hay paquete seleccionado
  const breakdown =
    selectedPackage && isPriceSet
      ? calculatePackageBreakdown(pricePerMessage, selectedPackage)
      : null

  // Verificar si tiene suficiente balance
  const hasInsufficientBalance = breakdown ? balance < breakdown.total : false

  const isLoading = isApprovePending || isApproveConfirming || isBuyPending || isBuyConfirming

  return (
    <div className="p-4 max-w-lg mx-auto">
      <Card className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-xl font-bold">Buy Message Package</h2>
            <p className="text-sm text-gray-600 mt-1">
              Send messages to {displayName}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Price: {priceFormatted} per message
            </p>
          </div>

          {/* Step 1: Seleccionar paquete */}
          {step === 'select' && (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">Select a package:</p>
                <div className="grid grid-cols-2 gap-2">
                  {PACKAGE_OPTIONS.map((pkg) => {
                    const pkgBreakdown = calculatePackageBreakdown(pricePerMessage, pkg.messages)
                    const isSelected = selectedPackage === pkg.messages

                    return (
                      <button
                        key={pkg.messages}
                        onClick={() => setSelectedPackage(pkg.messages)}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-lg font-bold">{pkg.messages}</div>
                        <div className="text-xs text-gray-600">messages</div>
                        <div className="text-sm font-semibold mt-1">
                          {pkgBreakdown.totalFormatted}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Breakdown */}
              {breakdown && (
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total:</span>
                    <span className="font-medium">{breakdown.totalFormatted}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">To {displayName}:</span>
                    <span>{breakdown.receiverAmountFormatted} (95%)</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Platform fee:</span>
                    <span>{breakdown.platformFeeFormatted} (5%)</span>
                  </div>
                </div>
              )}

              {/* Balance Check */}
              {hasInsufficientBalance && (
                <div className="p-2 rounded bg-red-50 border border-red-200">
                  <p className="text-xs text-red-700">
                    Insufficient cUSD balance. You need {breakdown?.totalFormatted}
                  </p>
                </div>
              )}

              {/* Next Button */}
              <Button
                onClick={() => setStep('approve')}
                disabled={!selectedPackage || hasInsufficientBalance}
                className="w-full"
              >
                Continue
              </Button>
            </>
          )}

          {/* Step 2: Aprobar cUSD */}
          {step === 'approve' && breakdown && (
            <>
              <div className="text-center space-y-2">
                <p className="text-sm">
                  <strong>Step 1 of 2:</strong> Approve cUSD
                </p>
                <p className="text-xs text-gray-600">
                  You need to approve the contract to spend {breakdown.totalFormatted} cUSD
                </p>
              </div>

              {approveError && (
                <div className="p-2 rounded bg-red-50 border border-red-200">
                  <p className="text-xs text-red-700">
                    Error: {approveError.message || 'Approval failed'}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={() => setStep('select')} variant="outline" disabled={isLoading}>
                  Back
                </Button>
                <Button
                  onClick={() => approve()}
                  disabled={isLoading || approvalStatus.hasAllowance}
                  className="flex-1"
                >
                  {isLoading
                    ? 'Approving...'
                    : approvalStatus.hasAllowance
                      ? 'Approved ✓'
                      : 'Approve cUSD'}
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Comprar paquete */}
          {step === 'buy' && breakdown && selectedPackage && (
            <>
              <div className="text-center space-y-2">
                <p className="text-sm">
                  <strong>Step 2 of 2:</strong> Buy Package
                </p>
                <p className="text-xs text-gray-600">
                  Purchase {selectedPackage} messages for {breakdown.totalFormatted}
                </p>
              </div>

              {buyError && (
                <div className="p-2 rounded bg-red-50 border border-red-200">
                  <p className="text-xs text-red-700">
                    Error: {buyError.message || 'Purchase failed'}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={() => setStep('approve')} variant="outline" disabled={isLoading}>
                  Back
                </Button>
                <Button onClick={() => buyPackage(selectedPackage)} disabled={isLoading} className="flex-1">
                  {isLoading ? 'Buying...' : 'Buy Package'}
                </Button>
              </div>
            </>
          )}

          {/* Step 4: Éxito */}
          {step === 'success' && selectedPackage && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-green-600">Purchase Successful!</h3>
                <p className="text-sm text-gray-600 mt-1">
                  You can now send {selectedPackage} messages to {displayName}
                </p>
              </div>
            </div>
          )}

          {/* Close Button */}
          {onClose && step !== 'success' && (
            <Button onClick={onClose} variant="outline" className="w-full mt-2">
              Cancel
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
