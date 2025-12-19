/**
 * Backfill historical M2M Chat events to Supabase
 *
 * This script indexes all past events from the M2M contract deployment
 * to catch up on transactions that happened before the database was set up.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-events.ts [--from-block <number>]
 */

import { createClient } from '@supabase/supabase-js'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { celo } from 'viem/chains'

const M2M_CONTRACT_ADDRESS = '0xf97743261a9C1584e1C882d7d5B9CcB9DE0CdeCc'

// Get contract deployment block from command line or use default
const args = process.argv.slice(2)
const fromBlockArg = args.findIndex(arg => arg === '--from-block')
const FROM_BLOCK = fromBlockArg !== -1
  ? BigInt(args[fromBlockArg + 1])
  : 28000000n // Approximate Celo block when contract was deployed

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

async function main() {
  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Initialize Celo client
  const publicClient = createPublicClient({
    chain: celo,
    transport: http('https://forno.celo.org'),
  })

  const currentBlock = await publicClient.getBlockNumber()
  console.log(`📊 Backfilling events from block ${FROM_BLOCK} to ${currentBlock}`)

  // Process in batches to avoid RPC timeouts
  const BATCH_SIZE = 1000n
  let fromBlock = FROM_BLOCK
  let totalEvents = 0

  while (fromBlock <= currentBlock) {
    const toBlock = fromBlock + BATCH_SIZE > currentBlock
      ? currentBlock
      : fromBlock + BATCH_SIZE

    console.log(`\n🔄 Processing blocks ${fromBlock} → ${toBlock}`)

    // Index MessagePackagePurchased
    const purchaseLogs = await publicClient.getLogs({
      address: M2M_CONTRACT_ADDRESS,
      event: EVENTS.MessagePackagePurchased,
      fromBlock,
      toBlock,
    })

    for (const log of purchaseLogs) {
      const { sender, recipient, messageCount, totalCost } = log.args
      const { error } = await supabase.from('message_packages').upsert({
        tx_hash: log.transactionHash,
        sender: sender!.toLowerCase(),
        recipient: recipient!.toLowerCase(),
        messages_purchased: Number(messageCount),
        total_cost: totalCost!.toString(),
        block_number: Number(log.blockNumber),
      }, { onConflict: 'tx_hash' })

      if (error && !error.message.includes('duplicate')) {
        console.error(`❌ Error inserting package:`, error)
      }
    }
    if (purchaseLogs.length > 0) {
      console.log(`  ✅ ${purchaseLogs.length} package purchases`)
      totalEvents += purchaseLogs.length
    }

    // Index MutualContactAdded
    const contactLogs = await publicClient.getLogs({
      address: M2M_CONTRACT_ADDRESS,
      event: EVENTS.MutualContactAdded,
      fromBlock,
      toBlock,
    })

    for (const log of contactLogs) {
      const { userA, userB } = log.args
      const [a, b] = [userA!.toLowerCase(), userB!.toLowerCase()].sort()

      const { error } = await supabase.from('mutual_contacts').upsert({
        user_a: a,
        user_b: b,
      })

      if (error && !error.message.includes('duplicate')) {
        console.error(`❌ Error inserting contact:`, error)
      }
    }
    if (contactLogs.length > 0) {
      console.log(`  ✅ ${contactLogs.length} mutual contacts`)
      totalEvents += contactLogs.length
    }

    // Index PriceUpdated
    const priceLogs = await publicClient.getLogs({
      address: M2M_CONTRACT_ADDRESS,
      event: EVENTS.PriceUpdated,
      fromBlock,
      toBlock,
    })

    for (const log of priceLogs) {
      const { user, newPrice } = log.args
      const userAddress = user!.toLowerCase()

      // Update user_pricing
      await supabase.from('user_pricing').upsert({
        address: userAddress,
        price_per_message: newPrice!.toString(),
      })

      // Record in price_updates history
      await supabase.from('price_updates').insert({
        user_address: userAddress,
        old_price: null,
        new_price: newPrice!.toString(),
        tx_hash: log.transactionHash!,
        block_number: Number(log.blockNumber),
      })
    }
    if (priceLogs.length > 0) {
      console.log(`  ✅ ${priceLogs.length} price updates`)
      totalEvents += priceLogs.length
    }

    // Index MessageCheckpointSubmitted
    const checkpointLogs = await publicClient.getLogs({
      address: M2M_CONTRACT_ADDRESS,
      event: EVENTS.MessageCheckpointSubmitted,
      fromBlock,
      toBlock,
    })

    for (const log of checkpointLogs) {
      const { sender, recipient, nonce, consumedCount } = log.args

      await supabase.from('message_checkpoints').upsert({
        sender: sender!.toLowerCase(),
        recipient: recipient!.toLowerCase(),
        nonce: Number(nonce),
        consumed_count: Number(consumedCount),
        signature: '',
        tx_hash: log.transactionHash,
        block_number: Number(log.blockNumber),
      })
    }
    if (checkpointLogs.length > 0) {
      console.log(`  ✅ ${checkpointLogs.length} checkpoints`)
      totalEvents += checkpointLogs.length
    }

    fromBlock = toBlock + 1n
  }

  // Update indexer state
  await supabase
    .from('indexer_state')
    .upsert({
      id: 1,
      last_block: Number(currentBlock),
      last_updated: new Date().toISOString(),
    })

  console.log(`\n✅ Backfill complete!`)
  console.log(`📦 Total events indexed: ${totalEvents}`)
  console.log(`🎯 Database synced to block ${currentBlock}`)
}

main().catch(console.error)
