'use client'

import { PackagePurchaseModal } from '@/components/m2m/PackagePurchaseModal'
import { PricingSettings } from '@/components/m2m/PricingSettings'
import { Card } from '@/components/ui/card'
import { useMutualContacts } from '@/hooks/use-messaging-access'
import { useState } from 'react'

export default function M2MPage() {
  const [selectedRecipient, setSelectedRecipient] = useState<`0x${string}` | ''>('')
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const { data: mutualContacts } = useMutualContacts()

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">M2M Chat Management</h1>
        <p className="text-gray-600">
          Manage your messaging contacts, pricing, and message credits
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pricing Settings */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Your Pricing</h2>
          <PricingSettings />
        </Card>

        {/* Mutual Contacts */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            Mutual Contacts ({mutualContacts?.length || 0})
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Free messaging with mutual contacts
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {mutualContacts && mutualContacts.length > 0 ? (
              mutualContacts.map((contact: string) => (
                <div
                  key={contact}
                  className="p-3 bg-gray-50 rounded-lg text-sm font-mono"
                >
                  {contact.slice(0, 10)}...{contact.slice(-8)}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No mutual contacts yet</p>
            )}
          </div>
        </Card>

        {/* Purchase Messages */}
        <Card className="p-6 md:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Purchase Message Credits</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Recipient Address
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={selectedRecipient}
                onChange={(e) => setSelectedRecipient(e.target.value as `0x${string}` | '')}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setShowPurchaseModal(true)}
              disabled={!selectedRecipient || selectedRecipient.length !== 42}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Purchase Message Package
            </button>
          </div>
        </Card>
      </div>

      {/* Purchase Modal */}
      {showPurchaseModal && selectedRecipient && (
        <PackagePurchaseModal
          receiverAddress={selectedRecipient as `0x${string}`}
          onClose={() => setShowPurchaseModal(false)}
        />
      )}
    </div>
  )
}
