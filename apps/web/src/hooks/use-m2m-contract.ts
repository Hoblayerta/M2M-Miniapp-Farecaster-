'use client'

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { M2M_CONTRACT, CUSD_TOKEN, ERC20_ABI } from '@/lib/contracts/m2m-config'
import type {
  ChatPermission,
  MessageBalance,
  ContactStatus,
  ApprovalStatus,
} from '@/types/m2m'
import { useState, useEffect } from 'react'

/**
 * Hook principal para interactuar con el contrato M2MChat
 */
export function useM2MContract() {
  return {
    address: M2M_CONTRACT.address,
    abi: M2M_CONTRACT.abi,
  }
}

/**
 * Hook para gestión de contactos
 * @param contactAddress - Dirección del contacto a gestionar
 */
export function useContacts(contactAddress?: `0x${string}`) {
  const { address: userAddress } = useAccount()
  const { writeContract, data: hash, isPending, error } = useWriteContract()

  // Verificar si el usuario actual ha agregado al contacto
  const { data: hasAdded, refetch: refetchHasAdded } = useReadContract({
    ...M2M_CONTRACT,
    functionName: 'hasAddedContact',
    args: userAddress && contactAddress ? [userAddress, contactAddress] : undefined,
    query: {
      enabled: !!userAddress && !!contactAddress,
    },
  })

  // Verificar si el contacto ha agregado al usuario actual
  const { data: isAdded, refetch: refetchIsAdded } = useReadContract({
    ...M2M_CONTRACT,
    functionName: 'hasAddedContact',
    args: contactAddress && userAddress ? [contactAddress, userAddress] : undefined,
    query: {
      enabled: !!userAddress && !!contactAddress,
    },
  })

  // Verificar si son contactos mutuos
  const { data: isMutual, refetch: refetchIsMutual } = useReadContract({
    ...M2M_CONTRACT,
    functionName: 'areMutualContacts',
    args: userAddress && contactAddress ? [userAddress, contactAddress] : undefined,
    query: {
      enabled: !!userAddress && !!contactAddress,
    },
  })

  // Esperar confirmación de la transacción
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  // Refrescar datos cuando la transacción se confirme
  useEffect(() => {
    if (isSuccess) {
      refetchHasAdded()
      refetchIsAdded()
      refetchIsMutual()
    }
  }, [isSuccess, refetchHasAdded, refetchIsAdded, refetchIsMutual])

  const addContact = async () => {
    if (!contactAddress) throw new Error('Contact address required')

    writeContract({
      ...M2M_CONTRACT,
      functionName: 'addContact',
      args: [contactAddress],
    })
  }

  const removeContact = async () => {
    if (!contactAddress) throw new Error('Contact address required')

    writeContract({
      ...M2M_CONTRACT,
      functionName: 'removeContact',
      args: [contactAddress],
    })
  }

  const contactStatus: ContactStatus = {
    hasAdded: hasAdded ?? false,
    isAdded: isAdded ?? false,
    isMutual: isMutual ?? false,
  }

  return {
    contactStatus,
    addContact,
    removeContact,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  }
}

/**
 * Hook para gestión de precios de mensajes
 * @param targetAddress - Dirección del usuario cuyo precio queremos consultar
 */
export function useMessagePricing(targetAddress?: `0x${string}`) {
  const { address: userAddress } = useAccount()
  const { writeContract, data: hash, isPending, error } = useWriteContract()

  // Obtener precio del target address (puede ser el propio usuario u otro)
  const { data: pricePerMessage, refetch: refetchPrice } = useReadContract({
    ...M2M_CONTRACT,
    functionName: 'pricePerMessage',
    args: targetAddress ? [targetAddress] : undefined,
    query: {
      enabled: !!targetAddress,
    },
  })

  // Esperar confirmación
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  // Refrescar precio cuando se confirme la transacción
  useEffect(() => {
    if (isSuccess) {
      refetchPrice()
    }
  }, [isSuccess, refetchPrice])

  const setMyPrice = async (priceInWei: bigint) => {
    if (!userAddress) throw new Error('User not connected')

    writeContract({
      ...M2M_CONTRACT,
      functionName: 'setMyMessagePrice',
      args: [priceInWei],
    })
  }

  return {
    pricePerMessage: pricePerMessage ?? BigInt(0),
    isPriceSet: pricePerMessage !== undefined && pricePerMessage > 0,
    setMyPrice,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  }
}

/**
 * Hook para gestión de paquetes de mensajes
 * @param receiverAddress - Dirección del receptor de mensajes
 */
export function useMessagePackages(receiverAddress?: `0x${string}`) {
  const { address: senderAddress } = useAccount()
  const { writeContract, data: hash, isPending, error } = useWriteContract()

  // Obtener balance de mensajes
  const { data: balance, refetch: refetchBalance } = useReadContract({
    ...M2M_CONTRACT,
    functionName: 'balances',
    args: senderAddress && receiverAddress ? [senderAddress, receiverAddress] : undefined,
    query: {
      enabled: !!senderAddress && !!receiverAddress,
    },
  })

  // Obtener mensajes disponibles
  const { data: availableMessages, refetch: refetchAvailable } = useReadContract({
    ...M2M_CONTRACT,
    functionName: 'getAvailableMessages',
    args: senderAddress && receiverAddress ? [senderAddress, receiverAddress] : undefined,
    query: {
      enabled: !!senderAddress && !!receiverAddress,
    },
  })

  // Verificar permisos de chat
  const { data: chatPermission, refetch: refetchPermission } = useReadContract({
    ...M2M_CONTRACT,
    functionName: 'canChat',
    args: senderAddress && receiverAddress ? [senderAddress, receiverAddress] : undefined,
    query: {
      enabled: !!senderAddress && !!receiverAddress,
    },
  })

  // Esperar confirmación
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  // Refrescar datos cuando se confirme
  useEffect(() => {
    if (isSuccess) {
      refetchBalance()
      refetchAvailable()
      refetchPermission()
    }
  }, [isSuccess, refetchBalance, refetchAvailable, refetchPermission])

  const buyPackage = async (messageCount: number) => {
    if (!receiverAddress) throw new Error('Receiver address required')
    if (!senderAddress) throw new Error('Sender not connected')

    writeContract({
      ...M2M_CONTRACT,
      functionName: 'buyMessagePackage',
      args: [receiverAddress, BigInt(messageCount)],
    })
  }

  const messageBalance: MessageBalance | undefined = balance
    ? {
        purchased: balance[0],
        consumed: balance[1],
        lastCheckpoint: balance[2],
        nonce: balance[3],
      }
    : undefined

  const permission: ChatPermission | undefined = chatPermission
    ? {
        allowed: chatPermission[0],
        accessType: chatPermission[1] as 'mutual' | 'paid' | 'none',
        messagesAvailable: chatPermission[2],
      }
    : undefined

  return {
    messageBalance,
    availableMessages: availableMessages ?? BigInt(0),
    chatPermission: permission,
    buyPackage,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  }
}

/**
 * Hook para gestión de aprobaciones de cUSD
 * @param requiredAmount - Cantidad requerida en wei
 */
export function useCUSDApproval(requiredAmount?: bigint) {
  const { address: userAddress } = useAccount()
  const { writeContract, data: hash, isPending, error } = useWriteContract()

  // Verificar allowance actual
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CUSD_TOKEN.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress ? [userAddress, M2M_CONTRACT.address] : undefined,
    query: {
      enabled: !!userAddress,
    },
  })

  // Verificar balance de cUSD
  const { data: balance } = useReadContract({
    address: CUSD_TOKEN.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  })

  // Esperar confirmación
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  // Refrescar allowance cuando se confirme
  useEffect(() => {
    if (isSuccess) {
      refetchAllowance()
    }
  }, [isSuccess, refetchAllowance])

  const approve = async (amount?: bigint) => {
    if (!userAddress) throw new Error('User not connected')

    const amountToApprove = amount ?? requiredAmount
    if (!amountToApprove) throw new Error('Amount required')

    writeContract({
      address: CUSD_TOKEN.address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [M2M_CONTRACT.address, amountToApprove],
    })
  }

  const currentAllowance = allowance ?? BigInt(0)
  const hasAllowance = requiredAmount ? currentAllowance >= requiredAmount : false
  const needsApproval = requiredAmount ? !hasAllowance : false

  const approvalStatus: ApprovalStatus = {
    hasAllowance,
    currentAllowance,
    requiredAmount: requiredAmount ?? BigInt(0),
    needsApproval,
  }

  return {
    approvalStatus,
    balance: balance ?? BigInt(0),
    approve,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  }
}
