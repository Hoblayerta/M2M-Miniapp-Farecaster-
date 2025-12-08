'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CheckpointResponse, CheckpointTriggerConfig } from '@/types/m2m'

/**
 * Hook para gestión automática de checkpoints
 * Trigger automático cada 25 mensajes o 1 hora
 *
 * @param sender - Dirección del remitente
 * @param receiver - Dirección del receptor
 * @param localConsumed - Número de mensajes enviados localmente
 * @param config - Configuración del trigger
 */
export function useCheckpointTrigger(
  sender: string | undefined,
  receiver: string | undefined,
  localConsumed: number,
  config?: Partial<CheckpointTriggerConfig>
) {
  const [lastCheckpoint, setLastCheckpoint] = useState(0)
  const [lastCheckpointTime, setLastCheckpointTime] = useState<number>(Date.now())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  // Configuración por defecto
  const fullConfig: CheckpointTriggerConfig = {
    messageThreshold: config?.messageThreshold ?? 25,
    timeThreshold: config?.timeThreshold ?? 3600, // 1 hora en segundos
  }

  // Ref para evitar múltiples submissions simultáneas
  const submittingRef = useRef(false)

  /**
   * Envía checkpoint al backend
   */
  const submitCheckpoint = useCallback(
    async (consumed: number) => {
      if (!sender || !receiver) {
        console.warn('Checkpoint skipped: sender or receiver not defined')
        return
      }

      // Evitar submissions duplicadas
      if (submittingRef.current) {
        console.warn('Checkpoint already submitting, skipping')
        return
      }

      submittingRef.current = true
      setIsSubmitting(true)
      setLastError(null)

      try {
        const response = await fetch('/api/checkpoint', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender,
            receiver,
            consumed,
          }),
        })

        const data: CheckpointResponse = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || `HTTP ${response.status}`)
        }

        // Actualizar estado solo si fue exitoso
        setLastCheckpoint(consumed)
        setLastCheckpointTime(Date.now())

        console.log('Checkpoint submitted successfully:', {
          consumed,
          txHash: data.txHash,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        setLastError(message)

        // Log error pero NO bloquear el chat
        console.error('Checkpoint submission failed:', message)
      } finally {
        setIsSubmitting(false)
        submittingRef.current = false
      }
    },
    [sender, receiver]
  )

  /**
   * Efecto para trigger automático de checkpoints
   */
  useEffect(() => {
    if (!sender || !receiver) return

    const messagesSinceCheckpoint = localConsumed - lastCheckpoint

    // Condición 1: Alcanzamos el threshold de mensajes
    const shouldCheckpointByMessages = messagesSinceCheckpoint >= fullConfig.messageThreshold

    // Condición 2: Ha pasado suficiente tiempo
    const timeSinceCheckpoint = (Date.now() - lastCheckpointTime) / 1000 // en segundos
    const shouldCheckpointByTime =
      messagesSinceCheckpoint > 0 && timeSinceCheckpoint >= fullConfig.timeThreshold

    if (shouldCheckpointByMessages || shouldCheckpointByTime) {
      console.log('Checkpoint trigger:', {
        reason: shouldCheckpointByMessages ? 'messages' : 'time',
        messagesSinceCheckpoint,
        timeSinceCheckpoint: timeSinceCheckpoint.toFixed(0) + 's',
        localConsumed,
      })

      submitCheckpoint(localConsumed)
    }
  }, [
    sender,
    receiver,
    localConsumed,
    lastCheckpoint,
    lastCheckpointTime,
    fullConfig.messageThreshold,
    fullConfig.timeThreshold,
    submitCheckpoint,
  ])

  /**
   * Función manual para forzar un checkpoint
   */
  const forceCheckpoint = useCallback(() => {
    if (localConsumed > lastCheckpoint) {
      console.log('Forcing checkpoint:', localConsumed)
      submitCheckpoint(localConsumed)
    }
  }, [localConsumed, lastCheckpoint, submitCheckpoint])

  return {
    lastCheckpoint,
    lastCheckpointTime,
    isSubmitting,
    lastError,
    forceCheckpoint,
    messagesSinceCheckpoint: localConsumed - lastCheckpoint,
    config: fullConfig,
  }
}

/**
 * Hook simplificado para trackear mensajes enviados localmente
 */
export function useLocalMessageCounter() {
  const [localConsumed, setLocalConsumed] = useState(0)

  const incrementCount = useCallback(() => {
    setLocalConsumed((prev) => prev + 1)
  }, [])

  const resetCount = useCallback(() => {
    setLocalConsumed(0)
  }, [])

  const setCount = useCallback((count: number) => {
    setLocalConsumed(count)
  }, [])

  return {
    localConsumed,
    incrementCount,
    resetCount,
    setCount,
  }
}
