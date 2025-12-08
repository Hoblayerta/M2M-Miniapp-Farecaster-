'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useMessagePricing } from '@/hooks/use-m2m-contract'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatPriceFromContract, parsePriceToContract } from '@/lib/m2m-utils'

export function PricingSettings() {
  const { address } = useAccount()
  const { pricePerMessage, isPriceSet, setMyPrice, isPending, isConfirming, isSuccess, error } =
    useMessagePricing(address)

  const [inputValue, setInputValue] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [inputError, setInputError] = useState<string | null>(null)

  // Mostrar mensaje de éxito temporalmente
  if (isSuccess && !showSuccess) {
    setShowSuccess(true)
    setInputValue('')
    setTimeout(() => setShowSuccess(false), 3000)
  }

  const currentPrice = isPriceSet ? formatPriceFromContract(pricePerMessage) : 'Not set'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setInputError(null)

    try {
      if (!inputValue || inputValue.trim() === '') {
        setInputError('Please enter a price')
        return
      }

      const priceWei = parsePriceToContract(inputValue)

      if (priceWei <= 0n) {
        setInputError('Price must be greater than 0')
        return
      }

      await setMyPrice(priceWei)
    } catch (err) {
      setInputError(err instanceof Error ? err.message : 'Invalid price format')
    }
  }

  const isLoading = isPending || isConfirming

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h3 className="font-medium text-lg">Message Pricing</h3>
          <p className="text-sm text-gray-600 mt-1">
            Set how much others pay to send you messages
          </p>
        </div>

        {/* Current Price */}
        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Current price per message:</span>
            <span className="font-semibold text-lg">{currentPrice}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
              New price (in USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                id="price"
                type="number"
                step="0.000001"
                min="0.000001"
                placeholder="0.20"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Example: $0.20 per message (minimum: $0.000001)
            </p>
          </div>

          {/* Input Error */}
          {inputError && (
            <div className="p-2 rounded bg-red-50 border border-red-200">
              <p className="text-xs text-red-700">{inputError}</p>
            </div>
          )}

          {/* Transaction Error */}
          {error && (
            <div className="p-2 rounded bg-red-50 border border-red-200">
              <p className="text-xs text-red-700">
                Error: {error.message || 'Transaction failed'}
              </p>
            </div>
          )}

          {/* Success Message */}
          {showSuccess && (
            <div className="p-2 rounded bg-green-50 border border-green-200">
              <p className="text-xs text-green-700">Price updated successfully!</p>
            </div>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Updating...' : 'Update Price'}
          </Button>
        </form>

        {/* Info */}
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-xs text-blue-700">
            <strong>Note:</strong> Mutual contacts can message you for free. This price only
            applies to non-contacts.
          </p>
        </div>
      </div>
    </Card>
  )
}
