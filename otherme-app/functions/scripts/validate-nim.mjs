/**
 * NIM (Nimiq Albatross RPC) verification harness for the Phase 4 reconciler.
 *
 * Two jobs:
 *  1. Offline: assert the recipientData hex→utf8 decode used by verifyNim.ts.
 *  2. Live (needs a clean network — run on a non-Avast box or Cloud Shell):
 *     probe the RPC endpoint to confirm it answers getBlockNumber and
 *     getTransactionByHash, and print the real response shape so the field
 *     names in verifyNim.ts (to / value / recipientData / confirmations) are
 *     confirmed against the actual node before relying on it.
 *
 * ── Run ──────────────────────────────────────────────────────────────────────
 *   cd otherme-app/functions
 *   node scripts/validate-nim.mjs                       # offline decode check
 *   node scripts/validate-nim.mjs <txHash>              # live, default RPC
 *   node scripts/validate-nim.mjs <txHash> <rpcUrl>     # live, custom RPC (our VM)
 */

const DEFAULT_RPC = 'https://rpc.nimiqwatch.com';

/** Same decode as verifyNim.ts: hex recipientData → utf8 tag. */
function decodeData(raw) {
  if (!raw)
    return '';
  const hex = raw.startsWith('0x') ? raw.slice(2) : raw;
  if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0)
    return Buffer.from(hex, 'hex').toString('utf8');
  return raw;
}

function runOffline() {
  console.log('\n=== NIM recipientData decode (offline) ===');
  const reference = 'otherme:abc123orderid';
  const hex = Buffer.from(reference, 'utf8').toString('hex'); // what the chain stores
  const checks = [
    ['bare hex decodes to the tag', decodeData(hex) === reference],
    ['0x-prefixed hex decodes', decodeData(`0x${hex}`) === reference],
    ['empty data → empty string', decodeData('') === ''],
  ];
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`${pass ? '✓' : '✗'} ${label}`);
    ok = ok && pass;
  }
  console.log(ok ? '\nRESULT: ✓ decode matches verifyNim.ts\n' : '\nRESULT: ✗ decode mismatch\n');
  return ok;
}

/** Albatross RPC wraps results as { data, metadata } — unwrap to the payload. */
const unwrap = res => (res && typeof res === 'object' && 'data' in res ? res.data : res);

async function rpc(url, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const body = await res.json();
  if (body.error)
    throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return unwrap(body.result);
}

async function runLive(txHash, url) {
  console.log(`\n=== NIM RPC live probe ===\nrpc: ${url}`);
  const head = await rpc(url, 'getBlockNumber', []);
  console.log(`✓ getBlockNumber → ${JSON.stringify(head)}`);

  const tx = await rpc(url, 'getTransactionByHash', [txHash]);
  console.log('getTransactionByHash →');
  console.log(JSON.stringify(tx, null, 2));
  // Highlight the fields verifyNim.ts depends on.
  if (tx && typeof tx === 'object') {
    console.log('\nfields used by verifyNim.ts:');
    console.log(`  to            = ${tx.to}`);
    console.log(`  value (Luna)  = ${tx.value}`);
    console.log(`  recipientData = ${tx.recipientData}  → "${decodeData(tx.recipientData)}"`);
    console.log(`  confirmations = ${tx.confirmations}`);
  }
}

async function main() {
  const [txHash, rpcUrl] = process.argv.slice(2);
  const offlineOk = runOffline();
  if (txHash) {
    try {
      await runLive(txHash, rpcUrl || DEFAULT_RPC);
    }
    catch (e) {
      console.error(`live probe failed: ${e.message} (network/CA, wrong method name, or RPC down?)`);
    }
  }
  else {
    console.log(`(pass a NIM txHash to live-probe ${DEFAULT_RPC} and confirm the response shape)`);
  }
  // Set exit code without process.exit() — a hard exit while the fetch keepalive
  // socket is still closing triggers a benign libuv assertion on Windows.
  process.exitCode = offlineOk ? 0 : 1;
}

main();
