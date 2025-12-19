// Tipos para el sistema M2M Chat

/**
 * Tipo de acceso al chat
 */
export type AccessType = 'mutual' | 'paid' | 'none'

/**
 * Estado de verificación de permisos de chat
 */
export interface ChatPermission {
  allowed: boolean
  accessType: AccessType
  messagesAvailable: bigint
}

/**
 * Balance de mensajes entre dos usuarios
 */
export interface MessageBalance {
  purchased: bigint
  consumed: bigint
  lastCheckpoint: bigint
  nonce: bigint
}

/**
 * Información de un paquete de mensajes
 */
export interface MessagePackage {
  messages: number
  label: string
}

/**
 * Estado de una transacción
 */
export type TransactionStatus = 'idle' | 'pending' | 'success' | 'error'

/**
 * Breakdown de costos de un paquete
 */
export interface PackageCostBreakdown {
  total: bigint
  platformFee: bigint
  receiverAmount: bigint
  totalFormatted: string
  platformFeeFormatted: string
  receiverAmountFormatted: string
  feePercentage: number
}

/**
 * Estado de contacto entre dos usuarios
 */
export interface ContactStatus {
  hasAdded: boolean // Si el usuario actual ha agregado al otro
  isAdded: boolean // Si el otro usuario ha agregado al usuario actual
  isMutual: boolean // Si son contactos mutuos
}

/**
 * Datos del checkpoint
 */
export interface CheckpointData {
  sender: string
  receiver: string
  consumed: number
  nonce: number
  chainId: number
}

/**
 * Respuesta del API de checkpoint
 */
export interface CheckpointResponse {
  success: boolean
  txHash?: string
  error?: string
}

/**
 * Configuración del trigger de checkpoints
 */
export interface CheckpointTriggerConfig {
  messageThreshold: number // Mensajes antes de hacer checkpoint (default: 25)
  timeThreshold: number // Segundos antes de hacer checkpoint (default: 3600 = 1 hora)
}

/**
 * Precio de mensajería de un usuario
 */
export interface UserPricing {
  address: string
  pricePerMessage: bigint
  priceFormatted: string
  isPriceSet: boolean
}

/**
 * Evento de ContactAdded del contrato
 */
export interface ContactAddedEvent {
  user: string
  contact: string
}

/**
 * Evento de PackagePurchased del contrato
 */
export interface PackagePurchasedEvent {
  sender: string
  receiver: string
  messageCount: bigint
  totalPaid: bigint
  pricePerMessage: bigint
}

/**
 * Evento de ConsumptionUpdated del contrato
 */
export interface ConsumptionUpdatedEvent {
  sender: string
  receiver: string
  consumed: bigint
}

/**
 * Estado de aprobación de cUSD
 */
export interface ApprovalStatus {
  hasAllowance: boolean
  currentAllowance: bigint
  requiredAmount: bigint
  needsApproval: boolean
}
