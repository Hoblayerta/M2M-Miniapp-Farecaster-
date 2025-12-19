'use client'

/**
 * EJEMPLO DE INTEGRACIÓN: Chat XMTP + M2M Smart Contract
 *
 * Este componente muestra cómo integrar el ChatGatekeeper con un componente de chat XMTP existente.
 * Los mensajes solo se pueden enviar si hay permisos (contactos mutuos o paquete comprado).
 * Cada mensaje enviado incrementa el contador local y trigger checkpoints automáticos.
 */

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Client } from '@xmtp/browser-sdk'
import { ChatGatekeeper } from './ChatGatekeeper'
import { useCheckpointTrigger, useLocalMessageCounter } from '@/hooks/use-checkpoint-trigger'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface IntegratedChatExampleProps {
  xmtpClient: Client
  receiverAddress: `0x${string}`
  receiverName?: string
}

export function IntegratedChatExample({
  xmtpClient,
  receiverAddress,
  receiverName,
}: IntegratedChatExampleProps) {
  const { address: senderAddress } = useAccount()
  const [messageInput, setMessageInput] = useState('')
  const [messages, setMessages] = useState<Array<{ text: string; sender: string }>>([])

  // Hook para trackear mensajes enviados localmente
  const { localConsumed, incrementCount } = useLocalMessageCounter()

  // Hook para checkpoints automáticos (cada 25 mensajes o 1 hora)
  const {
    lastCheckpoint,
    messagesSinceCheckpoint,
    isSubmitting: isCheckpointing,
    lastError: checkpointError,
  } = useCheckpointTrigger(senderAddress, receiverAddress, localConsumed)

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !xmtpClient) return

    try {
      // 1. Enviar mensaje via XMTP (tu lógica existente)
      // await xmtpClient.sendMessage(receiverAddress, messageInput)

      // 2. Agregar a la lista local (simulación)
      setMessages((prev) => [
        ...prev,
        {
          text: messageInput,
          sender: senderAddress || 'You',
        },
      ])

      // 3. Incrementar contador local
      // IMPORTANTE: Esto trigger el checkpoint automático cuando alcanza el threshold
      incrementCount()

      // 4. Limpiar input
      setMessageInput('')
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  return (
    <div className="space-y-4">
      {/* Gatekeeper - Verifica permisos antes de permitir chat */}
      <ChatGatekeeper receiverAddress={receiverAddress} receiverName={receiverName}>
        {/* Componente de chat - Solo visible si hay permisos */}
        <Card className="p-4">
          <div className="space-y-4">
            {/* Header con info de checkpoint */}
            {localConsumed > 0 && (
              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                <div className="flex justify-between">
                  <span>Messages sent: {localConsumed}</span>
                  <span>Last checkpoint: {lastCheckpoint}</span>
                </div>
                {messagesSinceCheckpoint > 0 && (
                  <div className="mt-1">
                    Next checkpoint in: {25 - messagesSinceCheckpoint} messages
                    {isCheckpointing && (
                      <span className="ml-2 text-blue-600">⏳ Syncing...</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Mensajes */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-8">
                  No messages yet. Start the conversation!
                </p>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg ${
                      msg.sender === senderAddress ? 'bg-blue-100 ml-auto' : 'bg-gray-100'
                    } max-w-[80%]`}
                  >
                    <p className="text-sm">{msg.text}</p>
                    <p className="text-xs text-gray-500 mt-1">{msg.sender}</p>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <Button onClick={handleSendMessage} disabled={!messageInput.trim()}>
                Send
              </Button>
            </div>

            {/* Checkpoint Error */}
            {checkpointError && (
              <div className="p-2 rounded bg-yellow-50 border border-yellow-200">
                <p className="text-xs text-yellow-700">
                  Checkpoint sync warning: {checkpointError}
                  <br />
                  <span className="text-yellow-600">
                    (Don&apos;t worry, you can keep chatting. We&apos;ll retry automatically)
                  </span>
                </p>
              </div>
            )}
          </div>
        </Card>
      </ChatGatekeeper>
    </div>
  )
}

/**
 * INSTRUCCIONES DE INTEGRACIÓN CON TU CHAT XMTP EXISTENTE:
 *
 * 1. Localiza tu componente de chat actual (probablemente en src/components/chat/ o similar)
 *
 * 2. Importa ChatGatekeeper:
 *    import { ChatGatekeeper } from '@/components/m2m/ChatGatekeeper'
 *
 * 3. Envuelve tu chat con ChatGatekeeper:
 *    <ChatGatekeeper receiverAddress={peerAddress} receiverName={peerName}>
 *      {/* Tu componente de chat existente *}
 *    </ChatGatekeeper>
 *
 * 4. Agrega tracking de mensajes enviados:
 *    import { useLocalMessageCounter } from '@/hooks/use-checkpoint-trigger'
 *
 *    const { localConsumed, incrementCount } = useLocalMessageCounter()
 *
 *    // En tu función de enviar mensaje, después de enviar via XMTP:
 *    await sendXMTPMessage(...)
 *    incrementCount() // Esto trigger checkpoints automáticos
 *
 * 5. Agrega el hook de checkpoints:
 *    import { useCheckpointTrigger } from '@/hooks/use-checkpoint-trigger'
 *
 *    const { lastCheckpoint, isSubmitting } = useCheckpointTrigger(
 *      senderAddress,
 *      receiverAddress,
 *      localConsumed
 *    )
 *
 * 6. (Opcional) Muestra info de checkpoint en el header:
 *    {localConsumed > 0 && (
 *      <div className="text-xs text-gray-600">
 *        Messages sent: {localConsumed} | Last checkpoint: {lastCheckpoint}
 *      </div>
 *    )}
 *
 * NOTAS IMPORTANTES:
 * - El ChatGatekeeper bloqueará el chat si no hay permisos
 * - Si hay permisos pagados, mostrará el balance restante
 * - Si son contactos mutuos, el chat es ilimitado
 * - Los checkpoints se ejecutan automáticamente cada 25 mensajes o 1 hora
 * - Los checkpoints NO bloquean el chat si fallan (solo se loguea el error)
 */
