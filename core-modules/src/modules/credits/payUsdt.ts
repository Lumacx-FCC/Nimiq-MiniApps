import { encodeFunctionData, parseUnits } from 'viem'
import { getConfig } from '../config'

/** USDT on Polygon — 6 decimals (NOT 18). */
export const USDT_POLYGON = {
  chainIdHex: '0x89',
  address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  decimals: 6,
} as const

const ERC20_TRANSFER_ABI = [{
  name: 'transfer',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  outputs: [{ name: '', type: 'bool' }],
}] as const

function getEthereum() {
  const provider = (window as any).ethereum
  if (!provider)
    throw new Error('Ethereum provider not available. Open this app inside Nimiq Pay.')
  return provider
}

/**
 * Pay `usdAmount` USDT (Polygon) to the treasury. Two native approval
 * dialogs: chain switch (if needed) and the transfer itself.
 * Returns the transaction hash.
 */
export async function payUsdt(usdAmount: number): Promise<string> {
  const provider = getEthereum()

  const [from] = await provider.request({ method: 'eth_requestAccounts' }) as string[]
  if (!from)
    throw new Error('No Ethereum account available')

  const currentChain = await provider.request({ method: 'eth_chainId' }) as string
  if (currentChain !== USDT_POLYGON.chainIdHex) {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: USDT_POLYGON.chainIdHex }],
    })
  }

  const data = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: 'transfer',
    args: [
      getConfig().evmTreasuryAddress as `0x${string}`,
      parseUnits(usdAmount.toString(), USDT_POLYGON.decimals),
    ],
  })

  return await provider.request({
    method: 'eth_sendTransaction',
    params: [{ from, to: USDT_POLYGON.address, data }],
  }) as string
}
