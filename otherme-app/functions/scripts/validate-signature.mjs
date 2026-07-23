/**
 * Signature-module validation harness.
 *
 * Goal: confirm the exact "Nimiq Signed Message" preimage the Nimiq Pay wallet
 * signs, and the @nimiq/core API to verify it — the two unknowns isolated in
 * src/auth/nimiqSignature.ts. This runs the crypto directly against ONE real
 * captured signature and reports which encoding verifies, so we can lock
 * nimiqSignature.ts to the correct one.
 *
 * No Firebase, no deploy, no build needed.
 *
 * ── How to capture a real signature (on a device, inside Nimiq Pay) ──────────
 * The wallet only signs inside the Nimiq Pay WebView, so capture on the phone.
 * Easiest: temporarily surface the result on screen from the app, e.g.
 *
 *     import { getNimiq } from '@core/auth/nimiqAuth'   // or the SDK provider
 *     const nimiq = await getNimiq()
 *     const [address] = await nimiq.listAccounts()
 *     const message = 'Other Me signature test 12345'
 *     const signed = await nimiq.sign(message)          // native approval
 *     // render this as selectable text / copy to clipboard:
 *     JSON.stringify({ message, address, publicKey: signed.publicKey, signature: signed.signature })
 *
 * Paste those four values into scripts/captured-signature.json.
 *
 * ── Run ──────────────────────────────────────────────────────────────────────
 *     cd firebase/functions
 *     npm install
 *     node scripts/validate-signature.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function loadCaptured() {
  const path = join(here, 'captured-signature.json');
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    for (const key of ['message', 'publicKey', 'signature', 'address']) {
      if (!raw[key] || String(raw[key]).startsWith('<'))
        throw new Error(`missing "${key}"`);
    }
    return raw;
  }
  catch (e) {
    console.error(`\nCould not read a valid scripts/captured-signature.json (${e.message}).`);
    console.error('Copy captured-signature.example.json to captured-signature.json and fill in real values from a device.\n');
    process.exit(1);
  }
}

const PREFIX = '\x16Nimiq Signed Message:\n';

/** Candidate preimages the wallet might have signed, most likely first. */
function candidatePreimages(message) {
  const enc = new TextEncoder();
  const framed = enc.encode(PREFIX + String(enc.encode(message).length) + message);
  const rawMsg = enc.encode(message);
  const sha256 = (bytes) => new Uint8Array(createHash('sha256').update(bytes).digest());
  return [
    { label: 'utf8(PREFIX + byteLength + message)', bytes: framed },
    { label: 'sha256(utf8(PREFIX + byteLength + message))', bytes: sha256(framed) },
    { label: 'utf8(message) raw', bytes: rawMsg },
    { label: 'sha256(utf8(message))', bytes: sha256(rawMsg) },
  ];
}

async function loadCore() {
  try {
    const Nimiq = await import('@nimiq/core');
    const init = Nimiq.default;
    if (typeof init === 'function') {
      try { await init(); }
      catch { /* already initialized or not required */ }
    }
    return Nimiq;
  }
  catch (e) {
    console.error(`\nCould not import @nimiq/core (${e.message}). Run "npm install" in firebase/functions first.\n`);
    process.exit(1);
  }
}

const norm = (a) => a.replace(/\s+/g, '').toUpperCase();

async function main() {
  const cap = loadCaptured();
  const Nimiq = await loadCore();

  console.log('\n=== Nimiq signature validation ===');
  console.log(`message : ${JSON.stringify(cap.message)}`);
  console.log(`address : ${cap.address}`);
  console.log(`@nimiq/core exports: ${Object.keys(Nimiq).filter(k => /key|sig|address/i.test(k)).join(', ') || '(inspect manually)'}\n`);

  let publicKey; let signature;
  try {
    publicKey = Nimiq.PublicKey.fromHex(cap.publicKey);
    signature = Nimiq.Signature.fromHex(cap.signature);
  }
  catch (e) {
    console.error(`✗ Could not parse publicKey/signature with PublicKey.fromHex / Signature.fromHex.`);
    console.error(`  API mismatch for this @nimiq/core version: ${e.message}`);
    console.error(`  Inspect the exports above and adjust both this script and src/auth/nimiqSignature.ts.\n`);
    process.exit(2);
  }

  // Address derived from the public key (independent of the message).
  let derived = '(unknown)';
  try {
    derived = norm(publicKey.toAddress().toUserFriendlyAddress());
  }
  catch (e) {
    console.error(`! address derivation failed: ${e.message}`);
  }
  const addressMatches = derived === norm(cap.address);
  console.log(`derived address: ${derived}  ${addressMatches ? '✓ matches' : '✗ DOES NOT match captured address'}\n`);

  let winner = null;
  for (const c of candidatePreimages(cap.message)) {
    let ok = false;
    let note = '';
    try {
      ok = publicKey.verify(signature, c.bytes);
    }
    catch (e) {
      note = ` (verify threw: ${e.message})`;
    }
    console.log(`${ok ? '✓' : '·'} ${c.label}${note}`);
    if (ok && !winner)
      winner = c.label;
  }

  console.log('');
  if (winner && addressMatches) {
    console.log(`RESULT: ✓ VALID. Correct preimage = "${winner}".`);
    console.log('If this differs from the current scheme, update buildSignedMessagePreimage() in src/auth/nimiqSignature.ts to match.\n');
    process.exit(0);
  }
  if (winner && !addressMatches) {
    console.log(`RESULT: signature verifies ("${winner}") but the derived address does not match — check the captured address/publicKey pairing.\n`);
    process.exit(3);
  }
  console.log('RESULT: ✗ No candidate preimage verified. Either the @nimiq/core verify API differs for this version, or the wallet uses a different encoding. Inspect the exports listed above.\n');
  process.exit(4);
}

main();
