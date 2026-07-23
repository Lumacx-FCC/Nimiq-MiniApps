/**
 * Nimiq signed-message verification — the security core of login.
 *
 * Nimiq Pay is the auth authority: the wallet signs when the user approves
 * sign(message). This only *verifies* the { publicKey, signature } it returned
 * and confirms the key derives to the claimed address. We never hold keys.
 *
 * CONFIRMED (2026-07-22) against a real device signature — see
 * functions/scripts/validate-signature.mjs:
 *   preimage = SHA-256( utf8( "\x16Nimiq Signed Message:\n" + byteLength + message ) )
 *   Ed25519-verified via @nimiq/core v2; PublicKey.toAddress() reproduced the
 *   signer's NQ… address exactly.
 *
 * @nimiq/core is ESM-only, so we load it via dynamic import() — same interop
 * pattern this codebase uses for @google/genai (CommonJS functions runtime).
 *
 * Failure mode is safe: a wrong preimage/API makes verify() return false, so
 * login is DENIED — it can never accept a bad signature.
 */
import { createHash } from "node:crypto";

type NimiqModule = typeof import("@nimiq/core");
let corePromise: Promise<NimiqModule> | null = null;

async function loadCore(): Promise<NimiqModule> {
  corePromise ??= (async () => {
    const Nimiq = await import("@nimiq/core");
    const maybeInit = (Nimiq as unknown as { default?: unknown }).default;
    if (typeof maybeInit === "function") {
      try {
        await (maybeInit as () => Promise<void>)();
      }
      catch {
        // Already initialized or no init needed for this build — ignore.
      }
    }
    return Nimiq;
  })();
  return corePromise;
}

const SIGNED_MESSAGE_PREFIX = "\x16Nimiq Signed Message:\n";

/**
 * The exact byte preimage the wallet signs:
 *   SHA-256( utf8( PREFIX + byteLength + message ) ).
 * Challenge messages are ASCII, so UTF-8 byte length == string length.
 */
function buildSignedMessagePreimage(message: string): Uint8Array {
  const messageByteLength = new TextEncoder().encode(message).length;
  const framed = new TextEncoder().encode(SIGNED_MESSAGE_PREFIX + String(messageByteLength) + message);
  return new Uint8Array(createHash("sha256").update(framed).digest());
}

export interface VerifyInput {
  message: string;
  publicKey: string;
  signature: string;
  claimedAddress: string;
}

export interface VerifyResult {
  ok: boolean;
  derivedAddress?: string;
  reason?: string;
}

function normalizeAddress(addr: string): string {
  return addr.replace(/\s+/g, "").toUpperCase();
}

export async function verifyNimiqSignature(input: VerifyInput): Promise<VerifyResult> {
  const Nimiq = await loadCore();

  let publicKey: import("@nimiq/core").PublicKey;
  let signature: import("@nimiq/core").Signature;
  try {
    publicKey = Nimiq.PublicKey.fromHex(input.publicKey);
    signature = Nimiq.Signature.fromHex(input.signature);
  }
  catch {
    return { ok: false, reason: "malformed public key or signature" };
  }

  const preimage = buildSignedMessagePreimage(input.message);

  let signatureValid: boolean;
  try {
    signatureValid = publicKey.verify(signature, preimage);
  }
  catch (e) {
    return { ok: false, reason: `verify() threw: ${e instanceof Error ? e.message : "unknown"}` };
  }
  if (!signatureValid)
    return { ok: false, reason: "signature does not match message" };

  let derivedAddress: string;
  try {
    derivedAddress = normalizeAddress(publicKey.toAddress().toUserFriendlyAddress());
  }
  catch (e) {
    return { ok: false, reason: `address derivation failed: ${e instanceof Error ? e.message : "unknown"}` };
  }

  if (derivedAddress !== normalizeAddress(input.claimedAddress))
    return { ok: false, reason: "signature is valid but for a different address" };

  return { ok: true, derivedAddress };
}
