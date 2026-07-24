/**
 * Minimal JSON-RPC 2.0 client used by the Phase 4 reconciler for both the
 * Polygon (USDT) and Nimiq Albatross (NIM) endpoints. No dependency — the
 * reconciler runs on a clean network, so the dev.mjs Avast CA shim does not
 * apply here.
 */

export interface RpcOptions {
  /** Optional HTTP basic auth (Nimiq node `[rpc-server]` user/password). */
  auth?: { user: string; pass: string };
  timeoutMs?: number;
}

export async function jsonRpc<T>(
  url: string,
  method: string,
  params: unknown[],
  opts: RpcOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth) {
    const token = Buffer.from(`${opts.auth.user}:${opts.auth.pass}`).toString("base64");
    headers.Authorization = `Basic ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    if (!res.ok)
      throw new Error(`RPC ${method} HTTP ${res.status}`);
    const body = await res.json() as { result?: T; error?: { message?: string } };
    if (body.error)
      throw new Error(`RPC ${method}: ${body.error.message || "error"}`);
    return body.result as T;
  }
  finally {
    clearTimeout(timer);
  }
}
