/**
 * Supabase Client Configuration
 *
 * This file provides Supabase clients for both client-side and server-side operations.
 *
 * - Client-side: Uses the public anon key (safe for frontend)
 * - Server-side: Uses service role key (full access, backend only)
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/**
 * Supabase client for client-side operations
 * Safe to use in browser (uses anon key with RLS policies)
 *
 * Note: During build time, env vars may not be available. This is OK since
 * the client is only used in browser (client components).
 */
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : (null as any) // Fallback for build time, will be initialized at runtime

/**
 * Supabase client for server-side operations (API routes, server components)
 * Uses service role key for full database access (bypasses RLS)
 *
 * WARNING: Only use in server-side code (API routes, server components)
 * NEVER expose service role key to the client!
 */
export function getServerSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. This function can only be used server-side.'
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Database types (auto-generated from Supabase schema)
 * TODO: Generate these types with `supabase gen types typescript`
 */
export interface Database {
  public: {
    Tables: {
      indexer_state: {
        Row: {
          id: number
          last_block: number
          last_updated: string
        }
        Insert: {
          id?: number
          last_block: number
          last_updated?: string
        }
        Update: {
          id?: number
          last_block?: number
          last_updated?: string
        }
      }
      user_pricing: {
        Row: {
          address: string
          price_per_message: string
          is_open_to_messages: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          address: string
          price_per_message: string
          is_open_to_messages?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          address?: string
          price_per_message?: string
          is_open_to_messages?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      message_packages: {
        Row: {
          id: string
          sender: string
          recipient: string
          messages_purchased: number
          messages_consumed: number
          total_cost: string
          tx_hash: string
          block_number: number
          purchased_at: string
        }
        Insert: {
          id?: string
          sender: string
          recipient: string
          messages_purchased: number
          messages_consumed?: number
          total_cost: string
          tx_hash: string
          block_number: number
          purchased_at?: string
        }
        Update: {
          id?: string
          sender?: string
          recipient?: string
          messages_purchased?: number
          messages_consumed?: number
          total_cost?: string
          tx_hash?: string
          block_number?: number
          purchased_at?: string
        }
      }
      mutual_contacts: {
        Row: {
          user_a: string
          user_b: string
          added_at: string
        }
        Insert: {
          user_a: string
          user_b: string
          added_at?: string
        }
        Update: {
          user_a?: string
          user_b?: string
          added_at?: string
        }
      }
      message_checkpoints: {
        Row: {
          sender: string
          recipient: string
          nonce: number
          consumed_count: number
          signature: string
          submitted_at: string
          tx_hash: string | null
          block_number: number | null
        }
        Insert: {
          sender: string
          recipient: string
          nonce: number
          consumed_count: number
          signature: string
          submitted_at?: string
          tx_hash?: string | null
          block_number?: number | null
        }
        Update: {
          sender?: string
          recipient?: string
          nonce?: number
          consumed_count?: number
          signature?: string
          submitted_at?: string
          tx_hash?: string | null
          block_number?: number | null
        }
      }
      price_updates: {
        Row: {
          id: string
          user_address: string
          old_price: string | null
          new_price: string
          tx_hash: string
          block_number: number
          updated_at: string
        }
        Insert: {
          id?: string
          user_address: string
          old_price?: string | null
          new_price: string
          tx_hash: string
          block_number: number
          updated_at?: string
        }
        Update: {
          id?: string
          user_address?: string
          old_price?: string | null
          new_price?: string
          tx_hash?: string
          block_number?: number
          updated_at?: string
        }
      }
    }
    Views: {
      messaging_access: {
        Row: {
          sender: string
          recipient: string
          remaining_messages: number
          last_purchase: string
          is_mutual_contact: boolean
        }
      }
    }
  }
}
