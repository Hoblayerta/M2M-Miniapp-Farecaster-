# XMTP Integration Guide

## 📦 Implementación Completada

Se ha integrado exitosamente XMTP (protocolo de mensajería descentralizada) en tu MiniApp de Farcaster en Celo.

---

## ✅ Archivos Creados

### 📁 Core Libraries
- `src/lib/xmtp-client.ts` - Cliente XMTP y utilidades
- `src/lib/anti-spam.ts` - Sistema anti-spam con rate limiting

### 🪝 React Hooks
- `src/hooks/use-xmtp-client.ts` - Hooks para cliente, conversaciones y mensajes

### 🎨 Componentes UI
- `src/components/xmtp/ChatWindow.tsx` - Ventana de chat persona a persona
- `src/components/xmtp/ConversationList.tsx` - Lista de conversaciones activas

### ⚙️ Contextos y Configuración
- `src/contexts/xmtp-context.tsx` - Contexto React para XMTP
- `src/app/chat/page.tsx` - Página principal de mensajería
- `src/lib/env.ts` - Variables de entorno actualizadas

### 🔧 Archivos Modificados
- `src/components/providers.tsx` - Agregado XMTPProvider
- `src/components/navbar.tsx` - Link a página de mensajes

---

## 🚀 Configuración

### 1. Variables de Entorno

Crea/actualiza tu archivo `.env.local`:

```bash
# XMTP Configuration
NEXT_PUBLIC_XMTP_ENV=production  # Usa "production" para wallets reales
```

**Opciones disponibles:**
- `production` → Red principal XMTP (mensajes permanentes, usuarios reales)
- `dev` → Red de pruebas XMTP (mensajes temporales, solo testing)

### 2. Iniciar Desarrollo

```bash
cd apps/web
pnpm dev
```

La app estará disponible en `http://localhost:3000`

---

## 📱 Cómo Usar

### Paso 1: Conectar Wallet
1. Abre la app en `http://localhost:3000`
2. Conecta tu wallet Celo/EVM compatible
3. XMTP se inicializará automáticamente

### Paso 2: Enviar Mensajes
1. Ve a `/chat` usando el navbar
2. Ingresa una dirección Ethereum en "Start New Chat"
3. El sistema verificará si la dirección puede recibir mensajes XMTP
4. ¡Comienza a chatear!

### Características Implementadas
✅ Chat persona a persona (P2P)
✅ Encriptación end-to-end automática
✅ Lista de conversaciones activas
✅ Verificación de direcciones XMTP
✅ Anti-spam con rate limiting (50 msg/hora por defecto)
✅ Interfaz responsive

---

## 🛡️ Sistema Anti-Spam

El sistema incluye protección anti-spam integrada:

### Características
- **Rate Limiting**: 50 mensajes por hora por dirección (configurable)
- **Blocklist/Allowlist**: Bloqueo/permitir direcciones manualmente
- **Verificación de direcciones**: Solo permite chatear con direcciones XMTP habilitadas

### Uso Programático

```typescript
import { antiSpam } from '@/lib/anti-spam'

// Bloquear dirección
antiSpam.block('0x...')

// Permitir dirección (bypass rate limit)
antiSpam.allow('0x...')

// Verificar si debe bloquearse
const shouldBlock = antiSpam.shouldBlock('0x...')

// Obtener mensajes restantes
const remaining = antiSpam.getRemainingMessages('0x...')
```

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────┐
│        Frame Wallet Provider        │
│         (Wagmi + Viem)              │
└─────────────────┬───────────────────┘
                  │
        ┌─────────▼──────────┐
        │   XMTP Provider    │
        │  (Browser SDK v2)  │
        └─────────┬──────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼───┐   ┌────▼─────┐  ┌───▼────┐
│ Chat  │   │ Convos   │  │ Hooks  │
│Window │   │   List   │  │        │
└───────┘   └──────────┘  └────────┘
```

### Flujo de Datos
1. Usuario conecta wallet → Wagmi/Viem signer
2. Signer → Conversión a XMTP Signer
3. XMTP Client inicializado con signer
4. Componentes usan hooks para acceder al cliente
5. Mensajes encriptados E2E automáticamente

---

## 🔧 API Reference

### Hooks

#### `useXMTP()`
Obtiene el contexto XMTP global.

```typescript
const { client, isReady, isInitializing, error, address } = useXMTP()
```

#### `useConversation(client, peerAddress)`
Maneja una conversación individual.

```typescript
const { conversation, messages, sendMessage, isLoading } = useConversation(
  client,
  '0x...'
)

await sendMessage('Hello!')
```

#### `useConversations(client)`
Lista todas las conversaciones activas.

```typescript
const { conversations, isLoading } = useConversations(client)
```

### Utilidades

#### `isValidEthAddress(address: string)`
Valida formato de dirección Ethereum.

#### `canMessage(client, addresses[])`
Verifica si direcciones pueden recibir mensajes XMTP.

---

## 📊 Estado del Proyecto

| Característica | Estado |
|----------------|--------|
| Chat P2P | ✅ Completo |
| Encriptación E2E | ✅ Automático |
| Lista conversaciones | ✅ Completo |
| Anti-spam | ✅ Completo |
| Grupos | ❌ No implementado |
| Archivos adjuntos | ❌ No implementado |
| Reacciones | ❌ No implementado |

---

## 🐛 Solución de Problemas

### Error: "Failed to initialize XMTP client"
- Verifica que el wallet esté conectado
- Asegúrate de tener `NEXT_PUBLIC_XMTP_ENV` configurado
- Revisa la consola del navegador para más detalles

### Error: "Address cannot receive XMTP messages"
- La dirección destino no ha habilitado XMTP
- Pídeles que se conecten a cualquier app XMTP primero
- Verifica que estés en la misma red (dev vs production)

### Mensajes no aparecen
- Verifica conexión a internet
- Refresca la página
- Revisa que ambos usuarios estén en la misma red XMTP

---

## 🔐 Seguridad

- ✅ Encriptación E2E nativa de XMTP
- ✅ Sin almacenamiento de claves privadas
- ✅ Firma de mensajes mediante wallet del usuario
- ✅ Rate limiting para prevenir spam
- ✅ Validación de direcciones antes de chatear

---

## 📚 Recursos

- [XMTP Docs](https://docs.xmtp.org)
- [Browser SDK Reference](https://github.com/xmtp/xmtp-web)
- [Repo de Referencia](https://github.com/builders-garden/xmtp-agent-examples-framesv2)

---

## 🚀 Próximos Pasos

### Funcionalidades Sugeridas
1. **Grupos** - Chats grupales usando XMTP Groups
2. **Notificaciones Push** - Alertas de nuevos mensajes
3. **Archivos Adjuntos** - Envío de imágenes/archivos
4. **Reacciones** - Emoji reactions a mensajes
5. **Estado de lectura** - Read receipts
6. **Búsqueda** - Buscar en conversaciones
7. **Perfil de usuario** - Avatar y nombre de usuario

### Integración con Smart Contracts
- Verificar permisos en smart contract antes de permitir mensajes
- Token-gated conversations (requiere NFT/token específico)
- Pagos por mensajes (micro-pagos en Celo)

---

## ✨ Implementado con

- **XMTP Browser SDK v2.0.2** - Protocolo de mensajería
- **Wagmi v2.14.12** - Wallet integration
- **Viem v2.27.2** - Ethereum utilities
- **Next.js 14** - React framework
- **Celo** - Blockchain layer

---

**¿Preguntas?** Revisa los archivos fuente o la documentación oficial de XMTP.
