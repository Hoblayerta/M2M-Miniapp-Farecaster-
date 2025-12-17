// Supabase Edge Function to index M2MChat contract events from Celo blockchain
// This function runs periodically (via cron) to sync blockchain state to Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createPublicClient, http, parseAbiItem, type Log } from 'https://esm.sh/viem@2'
import { celo } from 'https://esm.sh/viem@2/chains'

const M2M_CONTRACT_ADDRESS = '0xf97743261a9C1584e1C882d7d5B9CcB9DE0CdeCc'

// Contract events we're indexing
const EVENTS = {
  MessagePackagePurchased: parseAbiItem(
    'event MessagePackagePurchased(address indexed sender, address indexed recipient, uint256 messageCount, uint256 totalCost)'
  ),
  MutualContactAdded: parseAbiItem(
    'event MutualContactAdded(address indexed userA, address indexed userB)'
  ),
  PriceUpdated: parseAbiItem(
    'event PriceUpdated(address indexed user, uint256 newPrice)'
  ),
  MessageCheckpointSubmitted: parseAbiItem(
    'event MessageCheckpointSubmitted(address indexed sender, address indexed recipient, uint256 nonce, uint256 consumedCount)'
  ),
}

interface IndexerState {
  id: number
  last_block: number
}

Deno.serve(async (req) => {
  try {
    // Initialize Supabase client with service role key (full access)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const celoRpcUrl = Deno.env.get('CELO_RPC_URL') || 'https://forno.celo.org'

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Initialize Celo public client
    const publicClient = createPublicClient({
      chain: celo,
      transport: http(celoRpcUrl),
    })

    console.log('🔍 Fetching indexer state...')

    // Get last indexed block
    const { data: stateData, error: stateError } = await supabase
      .from('indexer_state')
      .select('last_block')
      .eq('id', 1)
      .single()

    if (stateError) {
      throw new Error(`Failed to fetch indexer state: ${stateError.message}`)
    }

    const lastIndexedBlock = BigInt(stateData?.last_block || 0)
    const currentBlock = await publicClient.getBlockNumber()

    console.log(`📊 Indexing blocks ${lastIndexedBlock + 1n} to ${currentBlock}`)

    if (lastIndexedBlock >= currentBlock) {
      return new Response(
        JSON.stringify({ message: 'Already up to date', current_block: currentBlock }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Calculate safe batch size (avoid timeouts)
    const batchSize = 1000n
    const fromBlock = lastIndexedBlock + 1n
    const toBlock = fromBlock + batchSize > currentBlock ? currentBlock : fromBlock + batchSize

    console.log(`🔄 Indexing batch: ${fromBlock} → ${toBlock}`)

    // Index MessagePackagePurchased events
    console.log('📦 Indexing message package purchases...')
    const purchaseLogs = await publicClient.getLogs({
      address: M2M_CONTRACT_ADDRESS,
      event: EVENTS.MessagePackagePurchased,
      fromBlock,
      toBlock,
    })

    for (const log of purchaseLogs) {
      const { sender, recipient, messageCount, totalCost } = log.args
      await supabase.from('message_packages').insert({
        sender: sender!.toLowerCase(),
        recipient: recipient!.toLowerCase(),
        messages_purchased: Number(messageCount),
        total_cost: totalCost!.toString(),
        tx_hash: log.transactionHash,
        block_number: Number(log.blockNumber),
      })
      console.log(`  ✅ Package: ${sender} → ${recipient} (${messageCount} msgs)`)
    }

    // Index MutualContactAdded events
    console.log('👥 Indexing mutual contacts...')
    const contactLogs = await publicClient.getLogs({
      address: M2M_CONTRACT_ADDRESS,
      event: EVENTS.MutualContactAdded,
      fromBlock,
      toBlock,
    })

    for (const log of contactLogs) {
      const { userA, userB } = log.args
      // Ensure consistent ordering (user_a < user_b)
      const [a, b] = [userA!.toLowerCase(), userB!.toLowerCase()].sort()

      const { error: insertError } = await supabase.from('mutual_contacts').upsert({
        user_a: a,
        user_b: b,
      })

      if (insertError && !insertError.message.includes('duplicate')) {
        console.error(`  ❌ Error inserting contact: ${insertError.message}`)
      } else {
        console.log(`  ✅ Contact: ${a} ↔ ${b}`)
      }
    }

    // Index PriceUpdated events
    console.log('💰 Indexing price updates...')
    const priceLogs = await publicClient.getLogs({
      address: M2M_CONTRACT_ADDRESS,
      event: EVENTS.PriceUpdated,
      fromBlock,
      toBlock,
    })

    for (const log of priceLogs) {
      const { user, newPrice } = log.args
      const userAddress = user!.toLowerCase()

      // Get old price for historical record
      const { data: existingPrice } = await supabase
        .from('user_pricing')
        .select('price_per_message')
        .eq('address', userAddress)
        .single()

      // Update user_pricing table
      await supabase.from('user_pricing').upsert({
        address: userAddress,
        price_per_message: newPrice!.toString(),
      })

      // Record in price_updates history
      await supabase.from('price_updates').insert({
        user_address: userAddress,
        old_price: existingPrice?.price_per_message || null,
        new_price: newPrice!.toString(),
        tx_hash: log.transactionHash,
        block_number: Number(log.blockNumber),
      })

      console.log(`  ✅ Price: ${userAddress} → ${newPrice}`)
    }

    // Index MessageCheckpointSubmitted events
    console.log('🎯 Indexing message checkpoints...')
    const checkpointLogs = await publicClient.getLogs({
      address: M2M_CONTRACT_ADDRESS,
      event: EVENTS.MessageCheckpointSubmitted,
      fromBlock,
      toBlock,
    })

    for (const log of checkpointLogs) {
      const { sender, recipient, nonce, consumedCount } = log.args

      // Update consumed count in message_packages
      const { data: packages } = await supabase
        .from('message_packages')
        .select('*')
        .eq('sender', sender!.toLowerCase())
        .eq('recipient', recipient!.toLowerCase())
        .order('purchased_at', { ascending: true })

      if (packages && packages.length > 0) {
        let remainingToConsume = Number(consumedCount)

        for (const pkg of packages) {
          if (remainingToConsume <= 0) break

          const available = pkg.messages_purchased - pkg.messages_consumed
          const toConsume = Math.min(available, remainingToConsume)

          if (toConsume > 0) {
            await supabase
              .from('message_packages')
              .update({ messages_consumed: pkg.messages_consumed + toConsume })
              .eq('id', pkg.id)

            remainingToConsume -= toConsume
          }
        }
      }

      // Record checkpoint submission
      await supabase.from('message_checkpoints').upsert({
        sender: sender!.toLowerCase(),
        recipient: recipient!.toLowerCase(),
        nonce: Number(nonce),
        consumed_count: Number(consumedCount),
        signature: '', // Not available in event, filled by relayer
        tx_hash: log.transactionHash,
        block_number: Number(log.blockNumber),
      })

      console.log(`  ✅ Checkpoint: ${sender} → ${recipient} (${consumedCount} consumed)`)
    }

    // Update indexer state
    console.log(`💾 Updating indexer state to block ${toBlock}`)
    await supabase
      .from('indexer_state')
      .update({ last_block: Number(toBlock), last_updated: new Date().toISOString() })
      .eq('id', 1)

    const summary = {
      success: true,
      indexed_from: Number(fromBlock),
      indexed_to: Number(toBlock),
      current_block: Number(currentBlock),
      events_indexed: {
        package_purchases: purchaseLogs.length,
        mutual_contacts: contactLogs.length,
        price_updates: priceLogs.length,
        checkpoints: checkpointLogs.length,
      },
      more_blocks_remaining: toBlock < currentBlock,
    }

    console.log('✅ Indexing complete:', summary)

    return new Response(JSON.stringify(summary), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('❌ Indexing error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
