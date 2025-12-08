import { NextRequest, NextResponse } from 'next/server'
import { createWalletClient, createPublicClient, http, keccak256, encodePacked } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'
import { M2M_CONTRACT } from '@/lib/contracts/m2m-config'
import { isValidAddress } from '@/lib/m2m-utils'
import type { CheckpointResponse } from '@/types/m2m'

/**
 * API Route para actualizar checkpoints de consumo de mensajes
 * POST /api/checkpoint
 *
 * Body: { sender: string, receiver: string, consumed: number }
 * Returns: { success: boolean, txHash?: string, error?: string }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Parsear body
    const body = await request.json()
    const { sender, receiver, consumed } = body

    // 2. Validaciones básicas
    if (!sender || !receiver || consumed === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: sender, receiver, consumed',
        } as CheckpointResponse,
        { status: 400 }
      )
    }

    // Validar direcciones
    if (!isValidAddress(sender) || !isValidAddress(receiver)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid address format',
        } as CheckpointResponse,
        { status: 400 }
      )
    }

    // Validar consumed
    const consumedNum = Number(consumed)
    if (isNaN(consumedNum) || consumedNum < 0 || consumedNum > 100_000) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid consumed value (must be 0-100,000)',
        } as CheckpointResponse,
        { status: 400 }
      )
    }

    // 3. Verificar que existe RELAYER_PRIVATE_KEY
    const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY

    if (!relayerPrivateKey) {
      console.error('RELAYER_PRIVATE_KEY not configured')
      return NextResponse.json(
        {
          success: false,
          error: 'Relayer not configured',
        } as CheckpointResponse,
        { status: 500 }
      )
    }

    // 4. Crear account del relayer
    const account = privateKeyToAccount(relayerPrivateKey as `0x${string}`)

    // 5. Crear clientes de viem
    const publicClient = createPublicClient({
      chain: celo,
      transport: http(),
    })

    const walletClient = createWalletClient({
      account,
      chain: celo,
      transport: http(),
    })

    // 6. Leer nonce actual del contrato
    const balance = (await publicClient.readContract({
      address: M2M_CONTRACT.address,
      abi: M2M_CONTRACT.abi,
      functionName: 'balances',
      args: [sender as `0x${string}`, receiver as `0x${string}`],
    })) as [bigint, bigint, bigint, bigint]

    const currentNonce = balance[3] // nonce es el 4to valor

    // 7. Crear firma del checkpoint
    // keccak256(sender, receiver, consumed, nonce, chainId)
    const messageHash = keccak256(
      encodePacked(
        ['address', 'address', 'uint256', 'uint256', 'uint256'],
        [
          sender as `0x${string}`,
          receiver as `0x${string}`,
          BigInt(consumedNum),
          currentNonce,
          BigInt(celo.id),
        ]
      )
    )

    // Firmar con el relayer
    const signature = await account.signMessage({
      message: { raw: messageHash },
    })

    // 8. Llamar updateConsumption en el contrato
    const hash = await walletClient.writeContract({
      address: M2M_CONTRACT.address,
      abi: M2M_CONTRACT.abi,
      functionName: 'updateConsumption',
      args: [sender as `0x${string}`, receiver as `0x${string}`, BigInt(consumedNum), signature],
    })

    // 9. Esperar confirmación (opcional, pero recomendado)
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    })

    if (receipt.status === 'reverted') {
      throw new Error('Transaction reverted')
    }

    console.log('Checkpoint updated successfully:', {
      sender,
      receiver,
      consumed: consumedNum,
      txHash: hash,
    })

    return NextResponse.json({
      success: true,
      txHash: hash,
    } as CheckpointResponse)
  } catch (error) {
    console.error('Checkpoint update error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      } as CheckpointResponse,
      { status: 500 }
    )
  }
}

// Rechazar otros métodos HTTP
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
