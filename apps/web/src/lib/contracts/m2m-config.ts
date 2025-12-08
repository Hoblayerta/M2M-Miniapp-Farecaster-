import { M2M_ABI } from './m2m-abi'

// Dirección del contrato M2MChat deployado en Celo Mainnet
export const M2M_CONTRACT = {
  address: '0xf97743261a9C1584e1C882d7d5B9CcB9DE0CdeCc' as `0x${string}`,
  abi: M2M_ABI,
} as const

// Token cUSD en Celo Mainnet
export const CUSD_TOKEN = {
  address: '0x765DE816845861e75A25fCA122bb6898B8B1282a' as `0x${string}`,
  decimals: 18,
  symbol: 'cUSD',
  name: 'Celo Dollar',
} as const

// Configuración de la cadena
export const CELO_CONFIG = {
  chainId: 42220,
  name: 'Celo Mainnet',
  rpcUrl: 'https://forno.celo.org',
  explorer: 'https://celoscan.io',
} as const

// Opciones de paquetes de mensajes disponibles
export const PACKAGE_OPTIONS = [
  { messages: 10, label: '10 mensajes' },
  { messages: 50, label: '50 mensajes' },
  { messages: 100, label: '100 mensajes' },
  { messages: 500, label: '500 mensajes' },
] as const

// Constantes del contrato
export const CONTRACT_CONSTANTS = {
  MIN_PACKAGE_SIZE: 10,
  MAX_PACKAGE_SIZE: 10000,
  PLATFORM_FEE_PERCENT: 5, // 5%
} as const

// ABI mínimo de ERC20 para approve y allowance
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const
