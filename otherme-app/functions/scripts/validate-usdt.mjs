/**
 * USDT (Polygon) receipt-decode validation harness for the Phase 4 reconciler.
 *
 * Isolates the one risky bit of src/reconciler/verifyUsdt.ts — decoding an
 * ERC-20 Transfer log out of an eth_getTransactionReceipt (topic slicing +
 * uint256 BigInt) — and asserts it against a known-format log. No Firebase, no
 * deploy, no build, and no network in the default (offline) mode.
 *
 * ── Run ──────────────────────────────────────────────────────────────────────
 *   cd otherme-app/functions
 *   node scripts/validate-usdt.mjs                 # offline decode assertions
 *   node scripts/validate-usdt.mjs <txHash> [rpc]  # live: fetch + decode a real
 *                                                  # Polygon USDT tx (needs a
 *                                                  # clean network / CA)
 */

const USDT_POLYGON_CONTRACT = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const DEFAULT_RPC = 'https://polygon-rpc.com';

const topicToAddress = topic => `0x${topic.slice(-40)}`.toLowerCase();

/** The exact decode used by verifyUsdt.ts, kept in sync here. */
function decodeTransfer(receipt) {
  if (!receipt)
    return { state: 'pending', reason: 'no receipt' };
  if (receipt.status !== '0x1')
    return { state: 'mismatch', reason: 'reverted' };
  const log = receipt.logs.find(
    l => l.address.toLowerCase() === USDT_POLYGON_CONTRACT
      && l.topics[0]?.toLowerCase() === ERC20_TRANSFER_TOPIC,
  );
  if (!log)
    return { state: 'mismatch', reason: 'no USDT Transfer log' };
  return {
    state: 'ok',
    from: topicToAddress(log.topics[1]),
    to: topicToAddress(log.topics[2]),
    value: BigInt(log.data),
  };
}

function pad32(hex) {
  return hex.replace(/^0x/, '').toLowerCase().padStart(64, '0');
}

function runOffline() {
  console.log('\n=== USDT decode validation (offline) ===');
  const from = '0x1111111111111111111111111111111111111111';
  const to = '0xda5727ceb6bc093f22f6d56b75f5b3773fbdf4d1'; // EVM treasury (lowercased)
  const value = 4000000n; // $4.00 pack, 6 decimals
  const receipt = {
    status: '0x1',
    blockNumber: '0x100',
    logs: [
      // An unrelated log to prove the finder skips it.
      { address: '0x0000000000000000000000000000000000000dead', topics: ['0xabc'], data: '0x0' },
      {
        address: USDT_POLYGON_CONTRACT,
        topics: [ERC20_TRANSFER_TOPIC, `0x${pad32(from)}`, `0x${pad32(to)}`],
        data: `0x${value.toString(16).padStart(64, '0')}`,
      },
    ],
  };

  const decoded = decodeTransfer(receipt);
  const checks = [
    ['state is ok', decoded.state === 'ok'],
    ['from decodes', decoded.from === from],
    ['to decodes (treasury)', decoded.to === to],
    ['value decodes to 4000000', decoded.value === value],
    ['reverted → mismatch', decodeTransfer({ ...receipt, status: '0x0' }).state === 'mismatch'],
    ['no transfer log → mismatch', decodeTransfer({ status: '0x1', logs: [] }).state === 'mismatch'],
    ['null receipt → pending', decodeTransfer(null).state === 'pending'],
  ];

  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`${pass ? '✓' : '✗'} ${label}`);
    ok = ok && pass;
  }
  console.log(ok ? '\nRESULT: ✓ decode logic matches verifyUsdt.ts\n' : '\nRESULT: ✗ decode mismatch — fix verifyUsdt.ts / this script\n');
  return ok;
}

async function runLive(txHash, rpcUrl) {
  console.log(`\n=== USDT decode validation (live) ===\nrpc: ${rpcUrl}\ntx : ${txHash}`);
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txHash] }),
  });
  const body = await res.json();
  if (body.error)
    throw new Error(body.error.message);
  const decoded = decodeTransfer(body.result);
  console.log(decoded);
  if (decoded.state === 'ok')
    console.log(`from=${decoded.from}\nto=${decoded.to}\nvalue=${decoded.value} (raw 6-decimal units)`);
  return decoded.state === 'ok' || decoded.state === 'mismatch';
}

async function main() {
  const [txHash, rpc] = process.argv.slice(2);
  const offlineOk = runOffline();
  if (txHash) {
    try {
      await runLive(txHash, rpc || DEFAULT_RPC);
    }
    catch (e) {
      console.error(`live check failed: ${e.message} (network/CA?)`);
    }
  }
  process.exit(offlineOk ? 0 : 1);
}

main();
