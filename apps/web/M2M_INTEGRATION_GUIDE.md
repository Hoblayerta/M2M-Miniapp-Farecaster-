# M2M Chat - Guía de Integración Frontend

## Resumen de la Integración

Se ha implementado completamente la integración del smart contract M2MChat con el frontend XMTP. La arquitectura funciona así:

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   XMTP      │◄────►│ ChatGatekeeper│◄────►│ M2MChat SC  │
│  Messaging  │      │  (Permisos)   │      │ (On-chain)  │
└─────────────┘      └──────────────┘      └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Checkpoint  │
                     │  API Route   │
                     └──────────────┘
```

## Archivos Implementados

### Configuración Base
- ✅ `src/lib/contracts/m2m-abi.ts` - ABI del contrato
- ✅ `src/lib/contracts/m2m-config.ts` - Configuración y constantes
- ✅ `src/lib/m2m-utils.ts` - Utilidades de conversión y validación
- ✅ `src/types/m2m.ts` - Tipos TypeScript

### Hooks
- ✅ `src/hooks/use-m2m-contract.ts` - Hooks principales:
  - `useM2MContract()` - Instancia del contrato
  - `useContacts()` - Gestión de contactos mutuos
  - `useMessagePricing()` - Precios de mensajes
  - `useMessagePackages()` - Compra y balance de paquetes
  - `useCUSDApproval()` - Aprobaciones de cUSD

- ✅ `src/hooks/use-checkpoint-trigger.ts` - Sistema de checkpoints automáticos

### Componentes UI
- ✅ `src/components/m2m/ContactManager.tsx` - Gestión de contactos
- ✅ `src/components/m2m/PricingSettings.tsx` - Configuración de precios
- ✅ `src/components/m2m/PackagePurchaseModal.tsx` - Modal de compra de paquetes
- ✅ `src/components/m2m/ChatGatekeeper.tsx` - Gatekeeper principal
- ✅ `src/components/m2m/IntegratedChatExample.tsx` - Ejemplo de integración

### Backend
- ✅ `src/app/api/checkpoint/route.ts` - API para checkpoints

### Configuración
- ✅ `.env.local` - Variables de entorno actualizadas
- ✅ `.env.template` - Template actualizado

## Integración con tu Chat XMTP Existente

### Paso 1: Agregar ChatGatekeeper a tu Componente de Chat

Localiza tu componente de chat principal (probablemente usa `ConversationList` o similar) y envuélvelo con `ChatGatekeeper`:

```tsx
import { ChatGatekeeper } from '@/components/m2m/ChatGatekeeper'

function YourChatComponent({ peerAddress, peerName }) {
  return (
    <ChatGatekeeper
      receiverAddress={peerAddress as `0x${string}`}
      receiverName={peerName}
    >
      {/* Tu componente de chat XMTP existente */}
      <YourXMTPChatUI />
    </ChatGatekeeper>
  )
}
```

### Paso 2: Agregar Tracking de Mensajes

En tu función que envía mensajes via XMTP, agrega el tracking:

```tsx
import { useLocalMessageCounter } from '@/hooks/use-checkpoint-trigger'

function YourChatComponent({ peerAddress }) {
  const { localConsumed, incrementCount } = useLocalMessageCounter()

  const sendMessage = async (text: string) => {
    // Tu lógica XMTP existente
    await xmtpClient.sendMessage(peerAddress, text)

    // NUEVO: Incrementar contador (esto trigger checkpoints automáticos)
    incrementCount()
  }

  return (...)
}
```

### Paso 3: Agregar Hook de Checkpoints

```tsx
import { useCheckpointTrigger } from '@/hooks/use-checkpoint-trigger'
import { useAccount } from 'wagmi'

function YourChatComponent({ peerAddress }) {
  const { address: senderAddress } = useAccount()
  const { localConsumed, incrementCount } = useLocalMessageCounter()

  // Hook que ejecuta checkpoints automáticamente
  const {
    lastCheckpoint,
    messagesSinceCheckpoint,
    isSubmitting: isCheckpointing,
    lastError: checkpointError
  } = useCheckpointTrigger(
    senderAddress,
    peerAddress,
    localConsumed
  )

  return (...)
}
```

### Paso 4: (Opcional) Mostrar Info de Checkpoints

Agrega un header con información del estado:

```tsx
{localConsumed > 0 && (
  <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
    <div className="flex justify-between">
      <span>Messages sent: {localConsumed}</span>
      <span>Last synced: {lastCheckpoint}</span>
    </div>
    {messagesSinceCheckpoint > 0 && (
      <div className="mt-1">
        Next sync in: {25 - messagesSinceCheckpoint} messages
        {isCheckpointing && <span className="ml-2">⏳ Syncing...</span>}
      </div>
    )}
  </div>
)}
```

## Componentes Adicionales Disponibles

### ContactManager
Gestiona contactos mutuos con un usuario específico:

```tsx
import { ContactManager } from '@/components/m2m/ContactManager'

<ContactManager
  contactAddress="0x..."
  contactName="Alice"
  onContactStatusChange={(isMutual) => {
    console.log('Contact status changed:', isMutual)
  }}
/>
```

### PricingSettings
Permite al usuario configurar su precio por mensaje:

```tsx
import { PricingSettings } from '@/components/m2m/PricingSettings'

<PricingSettings />
```

### PackagePurchaseModal
Modal para comprar paquetes de mensajes:

```tsx
import { PackagePurchaseModal } from '@/components/m2m/PackagePurchaseModal'

<PackagePurchaseModal
  receiverAddress="0x..."
  receiverName="Bob"
  onSuccess={() => console.log('Package purchased!')}
  onClose={() => setShowModal(false)}
/>
```

## Variables de Entorno Requeridas

Asegúrate de configurar estas variables en `.env.local`:

```bash
# Públicas (frontend)
NEXT_PUBLIC_M2M_CONTRACT_ADDRESS=0xf97743261a9C1584e1C882d7d5B9CcB9DE0CdeCc
NEXT_PUBLIC_CUSD_TOKEN=0x765DE816845861e75A25fCA122bb6898B8B1282a
NEXT_PUBLIC_CHAIN_ID=42220

# Privadas (backend solamente)
RELAYER_PRIVATE_KEY=0x... # ⚠️ MANTÉN ESTO SECRETO
```

## Testing Manual

### 1. Agregar Contacto Mutuo (Chat Gratis)

**Objetivo:** Verificar que dos usuarios pueden chatear gratis si se agregan mutuamente.

1. Usuario A conecta su wallet
2. Usuario A va al perfil de Usuario B
3. Usuario A hace clic en "Add Contact"
4. Confirma la transacción (~$0.0001 gas)
5. Usuario B repite los pasos 1-4 agregando a Usuario A
6. Ahora ambos ven "Mutual Contact" y pueden chatear ilimitadamente

**Verificación:**
- Badge verde "Mutual contact • Free unlimited messaging"
- Chat no muestra contador de mensajes
- No se requiere comprar paquetes

### 2. Establecer Precio de Mensajes

**Objetivo:** Configurar cuánto cobras por mensaje.

1. Usuario B va a configuración
2. Abre "PricingSettings"
3. Ingresa "$0.20" (o cualquier precio)
4. Hace clic en "Update Price"
5. Confirma transacción

**Verificación:**
- El precio se muestra correctamente
- Otros usuarios ven este precio al intentar comprar paquetes

### 3. Comprar Paquete de Mensajes

**Objetivo:** Usuario A compra mensajes para chatear con Usuario C (no mutuo).

1. Usuario A intenta chatear con Usuario C
2. Ve mensaje "Cannot Message User C"
3. Hace clic en "Buy Message Package"
4. Ve opciones: 10, 50, 100, 500 mensajes
5. Selecciona "50 messages" (ejemplo: $10.00 total)
6. Ve breakdown:
   - Total: $10.00
   - To User C: $9.50 (95%)
   - Platform fee: $0.50 (5%)
7. Hace clic en "Continue"
8. **Paso 1:** Aprueba cUSD ($10.00)
9. **Paso 2:** Compra el paquete
10. Ve mensaje de éxito

**Verificación:**
- Balance de cUSD se redujo en $10.00
- Chat ahora muestra "50 messages remaining"
- Puede enviar mensajes
- Usuario C recibió $9.50 en su wallet
- Fee collector recibió $0.50

### 4. Envío de Mensajes y Checkpoint

**Objetivo:** Verificar tracking y checkpoints automáticos.

1. Usuario A envía mensaje 1 a Usuario C
2. Contador local: "Messages sent: 1"
3. Header muestra: "Next sync in: 24 messages"
4. Usuario A continúa enviando mensajes...
5. Al mensaje 25, automáticamente se ejecuta checkpoint
6. Se ve "⏳ Syncing..." temporalmente
7. Header actualiza: "Last synced: 25"
8. Balance on-chain ahora muestra: consumed = 25

**Verificación:**
- Contador local incrementa con cada mensaje
- Checkpoint se ejecuta automáticamente cada 25 mensajes
- Balance on-chain se actualiza correctamente
- Chat no se bloquea durante el checkpoint

### 5. Agotamiento de Mensajes

**Objetivo:** Verificar bloqueo cuando se acaban los mensajes.

1. Usuario A envía los 50 mensajes comprados
2. Al llegar a 0: Chat se bloquea automáticamente
3. Muestra mensaje "You've used all your messages"
4. Botón "Buy More Messages" visible

**Verificación:**
- Chat se bloquea exactamente en 0
- No permite enviar más mensajes
- Modal de compra se abre correctamente

### 6. Checkpoint por Tiempo

**Objetivo:** Verificar checkpoint automático después de 1 hora.

1. Usuario A envía 10 mensajes
2. Espera 1 hora (o ajusta config para testing)
3. Envía mensaje 11
4. Checkpoint se ejecuta automáticamente

**Verificación:**
- Checkpoint se ejecuta por tiempo, no solo por cantidad
- Balance on-chain se actualiza con los 11 mensajes

### 7. Remover Contacto

**Objetivo:** Verificar que remover contacto vuelve a requerir pago.

1. Usuario A y Usuario B son contactos mutuos
2. Usuario A hace clic en "Remove Contact"
3. Confirma transacción
4. Ahora ya no son mutuos
5. Para chatear, Usuario A debe comprar paquete

**Verificación:**
- Badge cambia de "Mutual" a "none"
- Chat requiere compra de paquete
- Usuario B sigue teniendo a A como contacto (unilateral)

## Troubleshooting

### Error: "Relayer not configured"
- Asegúrate de haber agregado `RELAYER_PRIVATE_KEY` en `.env.local`
- Reinicia el servidor de desarrollo

### Error: "Invalid signature" en checkpoint
- Verifica que el RELAYER_PRIVATE_KEY sea correcto
- Verifica que coincida con el relayer del contrato

### Error: "Price not set" al comprar paquete
- El receptor debe establecer su precio primero
- Usa `PricingSettings` component

### Chat no se bloquea cuando mensajes = 0
- Verifica que `ChatGatekeeper` esté envolviendo tu chat
- Verifica que `localConsumed` se esté incrementando

### Checkpoints no se ejecutan
- Verifica que el API endpoint `/api/checkpoint` esté funcionando
- Revisa la consola del navegador para errores
- Verifica que `useCheckpointTrigger` esté siendo llamado

## Optimizaciones Futuras

- [ ] Rate limiting en `/api/checkpoint`
- [ ] Batch checkpoints para múltiples conversaciones
- [ ] Cache de permisos para reducir llamadas RPC
- [ ] Optimistic updates en compra de paquetes
- [ ] Notificaciones cuando alguien te agrega como contacto
- [ ] Panel de estadísticas (mensajes enviados/recibidos, ganancias)
- [ ] Sistema de suscripciones (alternativa a paquetes)

## Soporte

Para problemas o preguntas sobre la integración, revisa:
1. Este documento
2. Comentarios en el código fuente
3. `IntegratedChatExample.tsx` para ejemplo completo
4. Logs de la consola del navegador y servidor
