import { getConfig } from '../config'
import { getNimiq } from '../auth/nimiqAuth'

const LUNA_PER_NIM = 100_000

/**
 * Pay `nimAmount` NIM to the treasury, tagging the transaction with the
 * app id and pack reference so the backend can reconcile credit grants.
 * One native approval dialog. Returns the transaction hash.
 */
export async function payNim(nimAmount: number, reference: string): Promise<string> {
  const nimiq = await getNimiq()
  const { nimTreasuryAddress, appId } = getConfig()

  return await nimiq.sendBasicTransactionWithData({
    recipient: nimTreasuryAddress,
    value: Math.round(nimAmount * LUNA_PER_NIM),
    data: `${appId}:${reference}`,
  })
}
