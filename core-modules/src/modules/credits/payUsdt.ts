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
 * Stable error code thrown when a USDT transfer fails because the wallet has no
 * native gas token (POL, formerly MATIC) on Polygon.
 *
 * NOTE (2026-07-23): Nimiq Pay mini apps get NO gas abstraction — the gasless
 * USDT experience is native-wallet-only, and `eth_sendTransaction` follows
 * standard EVM gas rules, so the user must hold POL. There is no in-app fix
 * (Polygon USDT has no permit/EIP-3009 for a relayer). We surface a clear
 * message and steer users to NIM (gasless + bonus). TODO: revisit — either
 * validate this UX on-device or drop the USDT rail entirely (as NimBomber and
 * other Nimiq mini apps do, going NIM-only).
 */
export const USDT_GAS_REQUIRED = 'USDT_GAS_REQUIRED'

/** True when a provider error is an out-of-gas-funds failure (not a rejection). */
function isGasFundsError(e: unknown): boolean {
  const err = e as { code?: number, message?: string, data?: { message?: string } }
  if (err?.code === 4001)
    return false // user rejected the dialog — not a gas problem
  const msg = (err?.message || err?.data?.message || String(e)).toLowerCase()
  if (/reject|denied|cancel/.test(msg))
    return false
  return /insufficient funds|gas \* price|out of gas|intrinsic gas|exceeds .*balance|insufficient.*(pol|matic)/.test(msg)
}

/**
 * Pay `usdAmount` USDT (Polygon) to the treasury. Two native approval
 * dialogs: chain switch (if needed) and the transfer itself.
 * Returns the transaction hash and the payer address (the `from` address is
 * needed server-side to bind the payment to an order — see the credits plan).
 */
export async function payUsdt(usdAmount: number): Promise<{ txHash: string, from: string }> {
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

  try {
    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from, to: USDT_POLYGON.address, data }],
    }) as string
    return { txHash, from }
  }
  catch (e) {
    // Reclassify "no POL for gas" into a stable code the UI localizes (§gas).
    if (isGasFundsError(e))
      throw new Error(USDT_GAS_REQUIRED)
    throw e
  }
}
