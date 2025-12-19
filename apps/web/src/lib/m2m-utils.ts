import { formatUnits, parseUnits } from 'viem'
import { CUSD_TOKEN, CONTRACT_CONSTANTS } from './contracts/m2m-config'

/**
 * Convierte precio del contrato (18 decimals) a string legible en USD
 * @param price - Precio en wei (bigint)
 * @returns String formateado como "$0.20"
 */
export function formatPriceFromContract(price: bigint): string {
  const usdValue = formatUnits(price, CUSD_TOKEN.decimals)
  const num = parseFloat(usdValue)

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(num)
}

/**
 * Convierte precio en USD a formato de contrato (18 decimals)
 * @param usdString - String como "0.20" o "$0.20"
 * @returns Precio en wei (bigint)
 */
export function parsePriceToContract(usdString: string): bigint {
  // Remover $ y espacios si existen
  const cleaned = usdString.replace(/[$\s,]/g, '')

  if (!cleaned || isNaN(parseFloat(cleaned))) {
    throw new Error('Precio inválido')
  }

  return parseUnits(cleaned, CUSD_TOKEN.decimals)
}

/**
 * Calcula el costo total de un paquete de mensajes
 * @param pricePerMsg - Precio por mensaje en wei (bigint)
 * @param messageCount - Cantidad de mensajes
 * @returns Total en wei (bigint)
 */
export function calculatePackageCost(pricePerMsg: bigint, messageCount: number): bigint {
  return pricePerMsg * BigInt(messageCount)
}

/**
 * Calcula la fee de la plataforma (5%)
 * @param totalCost - Costo total en wei (bigint)
 * @returns Fee en wei (bigint)
 */
export function calculatePlatformFee(totalCost: bigint): bigint {
  return (totalCost * BigInt(CONTRACT_CONSTANTS.PLATFORM_FEE_PERCENT)) / BigInt(100)
}

/**
 * Calcula el monto que recibe el destinatario (95%)
 * @param totalCost - Costo total en wei (bigint)
 * @returns Monto neto en wei (bigint)
 */
export function calculateReceiverAmount(totalCost: bigint): bigint {
  const fee = calculatePlatformFee(totalCost)
  return totalCost - fee
}

/**
 * Valida que una dirección sea válida de Ethereum/Celo
 * @param addr - Dirección a validar
 * @returns true si es válida
 */
export function isValidAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr)
}

/**
 * Valida que un tamaño de paquete esté dentro de los límites
 * @param size - Tamaño del paquete
 * @returns true si es válido
 */
export function isValidPackageSize(size: number): boolean {
  return (
    size >= CONTRACT_CONSTANTS.MIN_PACKAGE_SIZE && size <= CONTRACT_CONSTANTS.MAX_PACKAGE_SIZE
  )
}

/**
 * Formatea un número grande de mensajes de forma legible
 * @param messages - Número de mensajes
 * @returns String formateado ("1,000" o "unlimited")
 */
export function formatMessageCount(messages: bigint | number): string {
  // type(uint256).max se usa para mensajes ilimitados (contactos mutuos)
  const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

  if (typeof messages === 'bigint' && messages >= maxUint256) {
    return 'unlimited'
  }

  const num = typeof messages === 'bigint' ? Number(messages) : messages

  return new Intl.NumberFormat('en-US').format(num)
}

/**
 * Trunca una dirección para mostrarla de forma compacta
 * @param address - Dirección completa
 * @param startChars - Caracteres al inicio (default: 6)
 * @param endChars - Caracteres al final (default: 4)
 * @returns Dirección truncada "0x1234...5678"
 */
export function truncateAddress(
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string {
  if (!isValidAddress(address)) return address

  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

/**
 * Calcula el breakdown de costos de un paquete
 * @param pricePerMsg - Precio por mensaje en wei
 * @param messageCount - Cantidad de mensajes
 * @returns Objeto con total, fee y receiver amount
 */
export function calculatePackageBreakdown(pricePerMsg: bigint, messageCount: number) {
  const total = calculatePackageCost(pricePerMsg, messageCount)
  const platformFee = calculatePlatformFee(total)
  const receiverAmount = calculateReceiverAmount(total)

  return {
    total,
    platformFee,
    receiverAmount,
    // Versiones formateadas para UI
    totalFormatted: formatPriceFromContract(total),
    platformFeeFormatted: formatPriceFromContract(platformFee),
    receiverAmountFormatted: formatPriceFromContract(receiverAmount),
    feePercentage: CONTRACT_CONSTANTS.PLATFORM_FEE_PERCENT,
  }
}

/**
 * Verifica si un valor es zero address
 * @param address - Dirección a verificar
 * @returns true si es 0x0000000000000000000000000000000000000000
 */
export function isZeroAddress(address: string): boolean {
  return address === '0x0000000000000000000000000000000000000000'
}

/**
 * Formatea timestamp a fecha legible
 * @param timestamp - Timestamp en segundos (number o bigint)
 * @returns Fecha formateada
 */
export function formatTimestamp(timestamp: number | bigint): string {
  const ts = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp
  const date = new Date(ts * 1000) // Convertir segundos a ms

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
