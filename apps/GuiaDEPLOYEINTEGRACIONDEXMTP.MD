# M2M Chat - Smart Contract Final + Prompt Claude Code

## 📄 Smart Contract Final (Sin límite de precio)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title M2MChat
 * @notice Sistema de mensajería anti-spam con contactos mutuos gratis y paquetes pagados
 * @dev Integra con XMTP - Vulnerabilidades corregidas + Sin límite de precio
 */
contract M2MChat is ReentrancyGuard, Ownable {
    using ECDSA for bytes32;

    // ═══════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════
    
    address public constant CUSD_TOKEN = 0x765DE816845861e75A25fCA122bb6898B8B1282a;
    uint256 public constant PLATFORM_FEE_PERCENT = 5; // 5%
    uint256 public constant MIN_PACKAGE_SIZE = 10;
    uint256 public constant MAX_PACKAGE_SIZE = 10000;
    
    // ═══════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════
    
    address public immutable feeCollector;
    address public relayer;
    bool public paused;
    
    // Contactos mutuos
    mapping(address => mapping(address => bool)) public hasAddedContact;
    
    // Pricing por usuario (sin límite máximo)
    mapping(address => uint256) public pricePerMessage;
    
    // Balances de mensajes
    struct MessageBalance {
        uint256 purchased;
        uint256 consumed;
        uint256 lastCheckpoint;
        uint256 nonce;
    }
    
    mapping(address => mapping(address => MessageBalance)) public balances;
    
    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════
    
    event ContactAdded(address indexed user, address indexed contact);
    event ContactRemoved(address indexed user, address indexed contact);
    event PriceSet(address indexed user, uint256 pricePerMessage);
    event PackagePurchased(
        address indexed sender,
        address indexed receiver,
        uint256 messageCount,
        uint256 totalPaid,
        uint256 pricePerMessage
    );
    event ConsumptionUpdated(
        address indexed sender,
        address indexed receiver,
        uint256 consumed
    );
    event RelayerUpdated(address indexed newRelayer);
    event Paused();
    event Unpaused();
    
    // ═══════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════
    
    error ContractPaused();
    error InvalidAddress();
    error InvalidPrice();
    error InvalidPackageSize();
    error AlreadyAdded();
    error NotAdded();
    error PriceNotSet();
    error InsufficientBalance();
    error InvalidSignature();
    error InvalidNonce();
    error Unauthorized();
    error ArithmeticOverflow();
    
    // ═══════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════
    
    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }
    
    modifier onlyRelayer() {
        if (msg.sender != relayer) revert Unauthorized();
        _;
    }
    
    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════
    
    constructor(address _feeCollector, address _relayer) Ownable(msg.sender) {
        if (_feeCollector == address(0) || _relayer == address(0)) 
            revert InvalidAddress();
        
        feeCollector = _feeCollector;
        relayer = _relayer;
    }
    
    // ═══════════════════════════════════════════════════════════
    // CONTACTOS MUTUOS
    // ═══════════════════════════════════════════════════════════
    
    function addContact(address contact) external whenNotPaused {
        if (contact == address(0)) revert InvalidAddress();
        if (contact == msg.sender) revert InvalidAddress();
        if (hasAddedContact[msg.sender][contact]) revert AlreadyAdded();
        
        hasAddedContact[msg.sender][contact] = true;
        emit ContactAdded(msg.sender, contact);
    }
    
    function removeContact(address contact) external whenNotPaused {
        if (!hasAddedContact[msg.sender][contact]) revert NotAdded();
        
        hasAddedContact[msg.sender][contact] = false;
        emit ContactRemoved(msg.sender, contact);
    }
    
    function areMutualContacts(address user1, address user2) 
        public 
        view 
        returns (bool) 
    {
        return hasAddedContact[user1][user2] && hasAddedContact[user2][user1];
    }
    
    // ═══════════════════════════════════════════════════════════
    // PRICING (SIN LÍMITE MÁXIMO)
    // ═══════════════════════════════════════════════════════════
    
    function setMyMessagePrice(uint256 _pricePerMessage) external whenNotPaused {
        if (_pricePerMessage == 0) revert InvalidPrice();
        
        pricePerMessage[msg.sender] = _pricePerMessage;
        emit PriceSet(msg.sender, _pricePerMessage);
    }
    
    // ═══════════════════════════════════════════════════════════
    // COMPRA DE PAQUETES
    // ═══════════════════════════════════════════════════════════
    
    function buyMessagePackage(address receiver, uint256 messageCount) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        // CHECKS
        if (receiver == address(0)) revert InvalidAddress();
        if (receiver == msg.sender) revert InvalidAddress();
        if (messageCount < MIN_PACKAGE_SIZE || messageCount > MAX_PACKAGE_SIZE) 
            revert InvalidPackageSize();
        
        uint256 price = pricePerMessage[receiver];
        if (price == 0) revert PriceNotSet();
        
        // OVERFLOW PROTECTION
        uint256 maxAllowedCount = type(uint256).max / price;
        if (messageCount > maxAllowedCount) revert ArithmeticOverflow();
        
        uint256 totalCost = price * messageCount;
        
        uint256 maxAllowedTotal = type(uint256).max / PLATFORM_FEE_PERCENT;
        if (totalCost > maxAllowedTotal) revert ArithmeticOverflow();
        
        uint256 platformFee = (totalCost * PLATFORM_FEE_PERCENT) / 100;
        uint256 receiverAmount = totalCost - platformFee;
        
        // INTERACTIONS 1: Sacar fondos del usuario
        bool success = IERC20(CUSD_TOKEN).transferFrom(
            msg.sender, 
            address(this), 
            totalCost
        );
        require(success, "Transfer from sender failed");
        
        // EFFECTS: Actualizar estado
        MessageBalance storage balance = balances[msg.sender][receiver];
        balance.purchased += messageCount;
        balance.lastCheckpoint = block.timestamp;
        
        // INTERACTIONS 2 y 3: Distribuir fondos
        bool successReceiver = IERC20(CUSD_TOKEN).transfer(receiver, receiverAmount);
        require(successReceiver, "Transfer to receiver failed");
        
        bool successFee = IERC20(CUSD_TOKEN).transfer(feeCollector, platformFee);
        require(successFee, "Transfer to fee collector failed");
        
        emit PackagePurchased(msg.sender, receiver, messageCount, totalCost, price);
    }
    
    // ═══════════════════════════════════════════════════════════
    // VERIFICACIÓN DE PERMISOS
    // ═══════════════════════════════════════════════════════════
    
    function canChat(address sender, address receiver) 
        external 
        view 
        returns (
            bool allowed,
            string memory accessType,
            uint256 messagesAvailable
        ) 
    {
        if (areMutualContacts(sender, receiver)) {
            return (true, "mutual", type(uint256).max);
        }
        
        MessageBalance memory balance = balances[sender][receiver];
        uint256 available = balance.purchased > balance.consumed 
            ? balance.purchased - balance.consumed 
            : 0;
        
        if (available > 0) {
            return (true, "paid", available);
        }
        
        return (false, "none", 0);
    }
    
    function getAvailableMessages(address sender, address receiver) 
        external 
        view 
        returns (uint256) 
    {
        MessageBalance memory balance = balances[sender][receiver];
        return balance.purchased > balance.consumed 
            ? balance.purchased - balance.consumed 
            : 0;
    }
    
    // ═══════════════════════════════════════════════════════════
    // CHECKPOINTS
    // ═══════════════════════════════════════════════════════════
    
    function updateConsumption(
        address sender,
        address receiver,
        uint256 newConsumed,
        bytes memory signature
    ) external onlyRelayer whenNotPaused {
        MessageBalance storage balance = balances[sender][receiver];
        
        if (newConsumed > balance.purchased) revert InsufficientBalance();
        if (newConsumed < balance.consumed) revert InvalidNonce();
        
        bytes32 messageHash = keccak256(
            abi.encodePacked(sender, receiver, newConsumed, balance.nonce, block.chainid)
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        
        if (ethSignedHash.recover(signature) != relayer) revert InvalidSignature();
        
        balance.consumed = newConsumed;
        balance.lastCheckpoint = block.timestamp;
        balance.nonce++;
        
        emit ConsumptionUpdated(sender, receiver, newConsumed);
    }
    
    // ═══════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════
    
    function setRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) revert InvalidAddress();
        relayer = newRelayer;
        emit RelayerUpdated(newRelayer);
    }
    
    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }
    
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }
    
    function emergencyWithdrawStuckTokens(address token, uint256 amount) 
        external 
        onlyOwner 
    {
        require(IERC20(token).transfer(owner(), amount), "Emergency withdraw failed");
    }
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}
```

---

## 📜 Deploy Script

```solidity
// script/Deploy.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/M2MChat.sol";

contract DeployM2MChat is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        address feeCollector = 0x0a01A6423D6bF683F53BFd8C18bF8375E1aA50BC;
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        M2MChat m2mChat = new M2MChat(feeCollector, deployer);
        
        console.log("===============================================");
        console.log("M2MChat deployed to:", address(m2mChat));
        console.log("Fee Collector:", feeCollector);
        console.log("Owner (admin):", m2mChat.owner());
        console.log("Relayer:", m2mChat.relayer());
        console.log("===============================================");
        
        vm.stopBroadcast();
    }
}
```

---

## 🤖 PROMPT PARA CLAUDE CODE

```markdown
# M2M Chat - Smart Contract Integration Feature

Implementa la integración completa del smart contract M2MChat con el frontend existente de la app M2M Chat (Farcaster miniapp con XMTP).

## CONTEXTO DEL PROYECTO

Esta es una app de mensajería anti-spam donde:
- Contactos mutuos chatean GRATIS ilimitadamente
- No-contactos pagan por paquetes de mensajes (10, 50, 100, 500)
- Cada usuario establece su propio precio por mensaje
- XMTP maneja los mensajes, el smart contract maneja los permisos

**Tech Stack Actual:**
- Framework: Next.js 14 (App Router)
- Blockchain: Celo (cUSD token)
- Wallet: Wagmi v2 + Viem v2
- Messaging: XMTP Browser SDK
- UI: shadcn/ui + Tailwind

## ARQUITECTURA DEL SISTEMA

```
Frontend (XMTP) ←→ Smart Contract (Permisos + Pagos) ←→ Backend (Checkpoints)
```

**División de responsabilidades:**
1. **Smart Contract**: Contactos, pricing, compra de paquetes, verificación de permisos
2. **XMTP**: Mensajes E2E encriptados, entrega, historial
3. **Frontend**: Gatekeeper (bloquea XMTP si no hay permisos), UI de compra/contactos
4. **Backend**: Checkpoints periódicos (cada 25 mensajes o 1 hora)

## CONTRATO DEPLOYADO

**Dirección:** [Pendiente - se agregará después del deploy]
**Chain:** Celo Mainnet (Chain ID: 42220)
**cUSD Token:** 0x765DE816845861e75A25fCA122bb6898B8B1282a

**ABI Relevante:**
```typescript
const M2M_ABI = [
  {
    "inputs": [{"name": "contact", "type": "address"}],
    "name": "addContact",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "contact", "type": "address"}],
    "name": "removeContact",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "user1", "type": "address"},
      {"name": "user2", "type": "address"}
    ],
    "name": "areMutualContacts",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "_pricePerMessage", "type": "uint256"}],
    "name": "setMyMessagePrice",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "", "type": "address"}],
    "name": "pricePerMessage",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "receiver", "type": "address"},
      {"name": "messageCount", "type": "uint256"}
    ],
    "name": "buyMessagePackage",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "sender", "type": "address"},
      {"name": "receiver", "type": "address"}
    ],
    "name": "canChat",
    "outputs": [
      {"name": "allowed", "type": "bool"},
      {"name": "accessType", "type": "string"},
      {"name": "messagesAvailable", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "sender", "type": "address"},
      {"name": "receiver", "type": "address"}
    ],
    "name": "getAvailableMessages",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "", "type": "address"},
      {"name": "", "type": "address"}
    ],
    "name": "balances",
    "outputs": [
      {"name": "purchased", "type": "uint256"},
      {"name": "consumed", "type": "uint256"},
      {"name": "lastCheckpoint", "type": "uint256"},
      {"name": "nonce", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
```

## TAREAS A IMPLEMENTAR

### 1. Configuración Base

**Archivo:** `src/lib/contracts/m2m-config.ts`
```typescript
export const M2M_CONTRACT = {
  address: '0x...' as const, // Se agregará después del deploy
  abi: M2M_ABI,
} as const;

export const CUSD_TOKEN = {
  address: '0x765DE816845861e75A25fCA122bb6898B8B1282a' as const,
  decimals: 18,
};

export const PACKAGE_OPTIONS = [
  { messages: 10, label: '10 mensajes' },
  { messages: 50, label: '50 mensajes' },
  { messages: 100, label: '100 mensajes' },
  { messages: 500, label: '500 mensajes' },
] as const;
```

### 2. Hooks Principales

**Archivo:** `src/hooks/use-m2m-contract.ts`

Crear hooks para:
- `useM2MContract()` - Instancia del contrato
- `useContacts()` - Add/remove/check mutual contacts
- `useMessagePricing()` - Set/get price per message
- `useMessagePackages()` - Buy packages, check balance
- `useCUSDApproval()` - Approve cUSD spending

**Ejemplo de estructura esperada:**
```typescript
export function useContacts() {
  const { address } = useAccount();
  const { data: contract } = useM2MContract();

  const addContact = async (contactAddress: string) => {
    // writeContract con addContact()
  };

  const removeContact = async (contactAddress: string) => {
    // writeContract con removeContact()
  };

  const { data: isMutual } = useReadContract({
    ...M2M_CONTRACT,
    functionName: 'areMutualContacts',
    args: [address, contactAddress],
  });

  return { addContact, removeContact, isMutual };
}
```

### 3. Componentes UI

**Archivo:** `src/components/m2m/contact-manager.tsx`
- Lista de contactos
- Botón "Add Contact"
- Badge indicando "Mutual" o "Pending"
- Botón "Remove Contact"

**Archivo:** `src/components/m2m/pricing-settings.tsx`
- Input para establecer precio por mensaje
- Mostrar precio actual
- Botón "Update Price"
- Conversión automática de cUSD (18 decimals) a USD visual

**Archivo:** `src/components/m2m/package-purchase-modal.tsx`
- Modal con 4 opciones de paquetes (10, 50, 100, 500 msgs)
- Mostrar precio total calculado: `pricePerMessage[receiver] * packageSize`
- Breakdown: "95% to recipient, 5% platform fee"
- Flujo: Approve cUSD → Buy Package
- Loading states
- Success/error toasts

**Archivo:** `src/components/m2m/chat-gatekeeper.tsx`
- Wrapper que verifica `canChat()` antes de mostrar XMTP
- Si `allowed === false`: Mostrar modal con opciones "Add Contact" o "Buy Package"
- Si `allowed === true && type === "paid"`: Mostrar header con balance restante
- Si `allowed === true && type === "mutual"`: Mostrar chat normal

### 4. Backend API

**Archivo:** `src/app/api/checkpoint/route.ts`

Endpoint que:
1. Recibe: `{ sender: string, receiver: string, consumed: number }`
2. Valida inputs básicos (formato address, número razonable)
3. Lee `nonce` actual del contrato
4. Firma checkpoint con relayer wallet: `keccak256(sender, receiver, consumed, nonce, chainId)`
5. Llama `updateConsumption()` en el contrato
6. Retorna: `{ success: boolean, txHash?: string, error?: string }`

**Consideraciones:**
- Usar `RELAYER_PRIVATE_KEY` de env
- Validación simple (suficiente para MVP):
  - Address regex: `/^0x[a-fA-F0-9]{40}$/`
  - Consumed: 0 - 100,000
- Manejo de errores con try/catch

### 5. Sistema de Checkpoints

**Archivo:** `src/hooks/use-checkpoint-trigger.ts`

Hook que:
- Trackea `localConsumed` (número de mensajes enviados)
- Trigger automático cada:
  - 25 mensajes enviados
  - O 1 hora transcurrida
- Hace POST a `/api/checkpoint`
- Actualiza `lastCheckpoint` y `lastCheckpointTime`
- NO bloquea el chat si falla (solo log error)

### 6. Integración con XMTP Existente

**Modificar archivo:** `src/components/chat/chat-window.tsx` (o similar)

Agregar:
- Wrapper `<ChatGatekeeper>` alrededor del componente de chat
- State `localConsumed` que incrementa con cada mensaje enviado
- Hook `useCheckpointTrigger(sender, receiver, localConsumed)`
- Header mostrando balance si es chat pagado: "27 messages remaining"
- Bloqueo de input cuando balance === 0 con CTA "Buy More Messages"

### 7. Utils y Helpers

**Archivo:** `src/lib/m2m-utils.ts`

Funciones:
- `formatPriceFromContract(price: bigint): string` - De 18 decimals a "$0.20"
- `parsePriceToContract(usd: string): bigint` - De "$0.20" a 18 decimals
- `calculatePackageCost(pricePerMsg: bigint, count: number): bigint`
- `isValidAddress(addr: string): boolean`

### 8. Environment Variables

**Archivo:** `.env.local`
```bash
# Public (frontend puede leer)
NEXT_PUBLIC_M2M_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_CUSD_TOKEN=0x765DE816845861e75A25fCA122bb6898B8B1282a
NEXT_PUBLIC_CHAIN_ID=42220

# Private (solo backend)
RELAYER_PRIVATE_KEY=0x...
```

## FLUJOS A IMPLEMENTAR

### Flujo 1: Agregar Contacto Mutuo (Chat Gratis)

1. User A va a perfil de User B
2. Click "Add Contact"
3. Tx: `addContact(addressB)` (gas: ~$0.0001)
4. User B ve notificación "User A added you"
5. User B click "Add Back"
6. Tx: `addContact(addressA)`
7. Ahora `areMutualContacts(A, B) === true`
8. Chat se habilita sin límites

### Flujo 2: Comprar Paquete de Mensajes

1. User A quiere mensajear a User C (no mutuo)
2. `canChat(A, C)` retorna `(false, "none", 0)`
3. Modal aparece: "Add Contact" o "Buy Package"
4. User A selecciona "Buy 50 messages"
5. Precio de C: $0.20/msg → Total: $10.00
6. Paso 1: Approve cUSD
   - `approve(M2M_CONTRACT, $10.00)`
7. Paso 2: Buy package
   - `buyMessagePackage(C, 50)`
8. Contrato:
   - Transfiere $10 de A al contrato
   - Actualiza `balances[A][C].purchased = 50`
   - Distribuye: $9.50 a C, $0.50 a platform
9. `canChat(A, C)` ahora retorna `(true, "paid", 50)`
10. Chat se habilita con header "50 messages remaining"

### Flujo 3: Envío de Mensajes y Checkpoint

1. User A envía mensaje a C via XMTP
2. `localConsumed++` (ahora = 1)
3. Mensaje 25: Trigger checkpoint
4. Frontend POST `/api/checkpoint` con `{ A, C, 25 }`
5. Backend:
   - Lee `balances[A][C].nonce` del contrato (ej. 0)
   - Firma: `keccak256(A, C, 25, 0, 42220)` con relayer key
   - Llama `updateConsumption(A, C, 25, signature)`
6. Contrato:
   - Verifica firma === relayer
   - Actualiza `consumed = 25`
   - Incrementa `nonce = 1`
7. UI actualiza: "25 messages remaining"

## REQUIREMENTS TÉCNICOS

- Usar Wagmi v2 hooks: `useReadContract`, `useWriteContract`, `useWaitForTransactionReceipt`
- Usar Viem v2 para formateo: `parseUnits`, `formatUnits`, `parseEther`
- Todos los precios en 18 decimals (wei para cUSD)
- Manejar loading states con spinners
- Toasts para success/error (usa shadcn/ui toast)
- Responsive design (mobile-first)
- TypeScript estricto (sin `any`)
- Comentarios en español en código

## ESTRUCTURA DE ARCHIVOS ESPERADA

```
src/
├── app/
│   └── api/
│       └── checkpoint/
│           └── route.ts
├── components/
│   └── m2m/
│       ├── contact-manager.tsx
│       ├── pricing-settings.tsx
│       ├── package-purchase-modal.tsx
│       └── chat-gatekeeper.tsx
├── hooks/
│   ├── use-m2m-contract.ts
│   └── use-checkpoint-trigger.ts
├── lib/
│   ├── contracts/
│   │   ├── m2m-config.ts
│   │   └── m2m-abi.ts
│   └── m2m-utils.ts
└── types/
    └── m2m.ts (tipos TypeScript para el sistema)
```

## VALIDACIONES IMPORTANTES

- Verificar que address conectada !== address destino (no auto-mensajes)
- Verificar que package size esté entre 10-10,000
- Verificar que precio > 0 antes de comprar
- Verificar allowance de cUSD antes de buyPackage
- Mostrar errores amigables al usuario (ej. "You don't have enough cUSD")

## ESTILOS Y UX

- Usar componentes de shadcn/ui: Button, Input, Dialog, Badge, Card, Toast
- Colores: Mantener tema existente de la app
- Iconos: lucide-react (MessageCircle, DollarSign, Check, X, etc.)
- Estados de carga con Skeleton o Spinner
- Animaciones sutiles con Tailwind animate-*
- Feedback inmediato: optimistic updates cuando sea posible

## TESTING MANUAL

Después de implementar, verifica:
1. ✅ Agregar contacto paga solo gas (~$0.0001)
2. ✅ Contactos mutuos chatean sin límite
3. ✅ Compra de paquete cobra el monto correcto
4. ✅ Balance se decrementa al enviar mensajes
5. ✅ Checkpoint se ejecuta cada 25 mensajes
6. ✅ Chat se bloquea cuando balance = 0
7. ✅ Modal de compra muestra precios correctos
8. ✅ Remover contacto hace que chat vuelva a requerir pago

## NOTAS FINALES

- Este es un MVP, no necesita rate limiting avanzado en `/api/checkpoint`
- Validaciones básicas son suficientes (no sobre-ingenierar)
- Priorizar funcionalidad sobre optimizaciones prematuras
- Código debe ser limpio y mantenible
- Comentar lógica compleja (especialmente conversiones de decimals)

Implementa esta funcionalidad completa de manera incremental, testeando cada parte antes de continuar. Empieza por la configuración base y hooks, luego componentes UI, y finalmente la integración con XMTP.
```

---

## 📦 Archivos Listos para Deployar

### `apps/contracts/foundry.toml`

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.19"

[rpc_endpoints]
celo = "https://forno.celo.org"
alfajores = "https://alfajores-forno.celo-testnet.org"
```

### `apps/contracts/.env.example`

```bash
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
```

---

## 🚀 Comandos de Deploy

```bash
# 1. Setup inicial
cd apps/contracts
forge init --force
forge install OpenZeppelin/openzeppelin-contracts --no-commit

# 2. Compilar
forge build

# 3. Deploy a Alfajores (testnet)
forge script script/Deploy.s.sol:DeployM2MChat \
  --rpc-url alfajores \
  --broadcast \
  -vvvv

# 4. Copiar el CONTRACT ADDRESS del output

# 5. Deploy a Celo Mainnet (cuando estés listo)
forge script script/Deploy.s.sol:DeployM2MChat \
  --rpc-url celo \
  --broadcast \
  -vvvv

# 6. Verificar contrato (opcional, Celo no requiere API key)
forge verify-contract <CONTRACT_ADDRESS> \
  src/M2MChat.sol:M2MChat \
  --chain-id 42220 \
  --watch
```

---

