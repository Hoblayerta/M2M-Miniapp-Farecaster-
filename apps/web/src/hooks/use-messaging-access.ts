/**
 * Hook to check messaging access between sender and recipient
 *
 * This hook queries the Supabase database to determine if a user can send messages
 * to a recipient based on:
 * 1. Mutual contact status (free messaging)
 * 2. Purchased message packages (paid messaging)
 *
 * Data is indexed from the M2MChat smart contract via Supabase Edge Functions
 */

import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { supabase } from '@/lib/supabase'

export interface MessagingAccessResult {
  canMessage: boolean
  reason: 'mutual_contact' | 'package_available' | 'no_credits' | 'not_connected' | 'loading'
  remainingMessages: number
  isMutualContact: boolean
  recipientPrice?: bigint
}

/**
 * Check if the connected user can message a recipient
 *
 * @param recipientAddress - The Ethereum address of the recipient
 * @param enabled - Whether to enable the query (default: true)
 * @returns MessagingAccessResult with canMessage status and remaining credits
 */
export function useMessagingAccess(recipientAddress?: string, enabled = true) {
  const { address } = useAccount()

  return useQuery({
    queryKey: ['messaging-access', address, recipientAddress],
    queryFn: async (): Promise<MessagingAccessResult> => {
      // Validation checks
      if (!address) {
        return {
          canMessage: false,
          reason: 'not_connected',
          remainingMessages: 0,
          isMutualContact: false,
        }
      }

      if (!recipientAddress) {
        return {
          canMessage: false,
          reason: 'loading',
          remainingMessages: 0,
          isMutualContact: false,
        }
      }

      // Normalize addresses to lowercase for consistent DB lookups
      const senderLower = address.toLowerCase()
      const recipientLower = recipientAddress.toLowerCase()

      console.log('🔍 Checking messaging access:', { sender: senderLower, recipient: recipientLower })

      // 1. Check mutual contacts first (free messaging)
      const [a, b] = [senderLower, recipientLower].sort()
      const { data: mutualContact, error: mutualError } = await supabase
        .from('mutual_contacts')
        .select('*')
        .eq('user_a', a)
        .eq('user_b', b)
        .maybeSingle()

      if (mutualError) {
        console.error('❌ Error checking mutual contacts:', mutualError)
      }

      if (mutualContact) {
        console.log('✅ Mutual contact found - free messaging enabled')
        return {
          canMessage: true,
          reason: 'mutual_contact',
          remainingMessages: Infinity,
          isMutualContact: true,
        }
      }

      // 2. Check message packages
      const { data: packages, error: packagesError } = await supabase
        .from('message_packages')
        .select('messages_purchased, messages_consumed')
        .eq('sender', senderLower)
        .eq('recipient', recipientLower)

      if (packagesError) {
        console.error('❌ Error checking message packages:', packagesError)
        return {
          canMessage: false,
          reason: 'no_credits',
          remainingMessages: 0,
          isMutualContact: false,
        }
      }

      // Calculate total remaining messages across all packages
      const remainingMessages =
        packages?.reduce(
          (sum: number, pkg: { messages_purchased: number; messages_consumed: number }) =>
            sum + (pkg.messages_purchased - pkg.messages_consumed),
          0
        ) || 0

      console.log('📦 Message packages:', {
        total_packages: packages?.length || 0,
        remaining_messages: remainingMessages,
      })

      // 3. Get recipient's pricing (optional, for UI display)
      const { data: recipientPricing } = await supabase
        .from('user_pricing')
        .select('price_per_message')
        .eq('address', recipientLower)
        .maybeSingle()

      const recipientPrice = recipientPricing?.price_per_message
        ? BigInt(recipientPricing.price_per_message)
        : undefined

      if (remainingMessages > 0) {
        console.log('✅ Message credits available:', remainingMessages)
        return {
          canMessage: true,
          reason: 'package_available',
          remainingMessages,
          isMutualContact: false,
          recipientPrice,
        }
      }

      console.log('❌ No messaging access - no credits or mutual contact')
      return {
        canMessage: false,
        reason: 'no_credits',
        remainingMessages: 0,
        isMutualContact: false,
        recipientPrice,
      }
    },
    enabled: enabled && !!address && !!recipientAddress,
    // Refetch every 15 seconds to catch blockchain updates
    refetchInterval: 15000,
    // Keep stale data while refetching for better UX
    staleTime: 10000,
  })
}

/**
 * Hook to get all mutual contacts for the connected user
 */
export function useMutualContacts() {
  const { address } = useAccount()

  return useQuery({
    queryKey: ['mutual-contacts', address],
    queryFn: async () => {
      if (!address) return []

      const addressLower = address.toLowerCase()

      // Query both user_a and user_b columns
      const { data, error } = await supabase
        .from('mutual_contacts')
        .select('*')
        .or(`user_a.eq.${addressLower},user_b.eq.${addressLower}`)

      if (error) {
        console.error('❌ Error fetching mutual contacts:', error)
        return []
      }

      // Map to get the other user's address
      return (
        data?.map((contact: { user_a: string; user_b: string }) => {
          return contact.user_a === addressLower ? contact.user_b : contact.user_a
        }) || []
      )
    },
    enabled: !!address,
    refetchInterval: 30000, // Refresh every 30s
  })
}

/**
 * Hook to get recipient's message pricing
 */
export function useRecipientPricing(recipientAddress?: string) {
  return useQuery({
    queryKey: ['recipient-pricing', recipientAddress],
    queryFn: async () => {
      if (!recipientAddress) return null

      const { data, error } = await supabase
        .from('user_pricing')
        .select('price_per_message, is_open_to_messages')
        .eq('address', recipientAddress.toLowerCase())
        .maybeSingle()

      if (error) {
        console.error('❌ Error fetching recipient pricing:', error)
        return null
      }

      return data
        ? {
            pricePerMessage: BigInt(data.price_per_message),
            isOpenToMessages: data.is_open_to_messages,
          }
        : null
    },
    enabled: !!recipientAddress,
    staleTime: 30000, // Cache for 30s
  })
}
