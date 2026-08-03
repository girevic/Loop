import type { Address } from 'viem'

const deployedAddress = '0x2dD3E92bEe97d279F1b2E3eF3db0e3E860A7F0C6'
const configuredAddress = import.meta.env.VITE_LOOP16_CONTRACT_ADDRESS
const zeroAddress = '0x0000000000000000000000000000000000000000'
const activeAddress = configuredAddress || deployedAddress

export const isContractConfigured =
  /^0x[a-fA-F0-9]{40}$/.test(activeAddress) &&
  activeAddress.toLowerCase() !== zeroAddress

export const LOOP16_ADDRESS = (
  isContractConfigured ? activeAddress : zeroAddress
) as Address

export const loop16Abi = [
  {
    type: 'function',
    name: 'addNote',
    inputs: [
      { name: 'sound', type: 'uint8' },
      { name: 'step', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'statsOf',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        name: 'stats',
        type: 'tuple',
        components: [
          { name: 'totalNotes', type: 'uint64' },
          { name: 'lastActiveDay', type: 'uint64' },
          { name: 'todayNotes', type: 'uint8' },
          { name: 'lastSound', type: 'uint8' },
          { name: 'lastStep', type: 'uint8' },
          { name: 'lastAddedAt', type: 'uint64' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getDayPattern',
    inputs: [{ name: 'day', type: 'uint64' }],
    outputs: [{ name: 'pattern', type: 'uint32[64]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'globalNotes',
    inputs: [],
    outputs: [{ name: '', type: 'uint64' }],
    stateMutability: 'view',
  },
] as const
