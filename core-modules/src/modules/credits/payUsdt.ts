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
 * NOTE (2026-07-27): Nimiq Pay mini apps get NO gas abstraction. The gasless
 * USDT experience is wallet-internal (OpenGSN v2 relay + a transfer contract
 * that swaps stablecoin → POL via Uniswap) and is not exposed to mini apps —
 * Nimiq's own docs say so (`mini-apps/features/evm-tokens.md`: "In a mini app,
 * standard EVM gas rules apply… The user must hold the native token"). There is
 * no native rail to switch to either: `@nimiq/mini-app-sdk@0.1.0` whitelists 10
 * NIM/Luna-only wallet methods, so `window.ethereum` is the only stablecoin
 * path. The user must hold POL; we surface a clear message and steer to NIM
 * (gasless + bonus).
 *
 * A fix IS possible, contrary to an earlier note here: Polygon USDT has no
 * EIP-2612 `permit`, but it is a `UChildERC20` and implements
 * `executeMetaTransaction` (Polygon's EIP-712 meta-transactions), and Nimiq Pay
 * exposes `eth_signTypedData_v4` — so the user can sign gaslessly and a relayer
 * we run can pay the POL. Deferred past Cycle I (needs a hot wallet, nonce-safe
 * sends, spend quotas, paid RPC). Design: `otherme-app/docs/usdt-gas-abstraction.md`.
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
