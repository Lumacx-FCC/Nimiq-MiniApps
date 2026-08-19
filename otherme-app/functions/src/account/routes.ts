/**
 * Account linking endpoints (Part B), mounted under /api/account by index.ts.
 *
 *   POST /api/account/link/start           (auth)       -> { code, expiresAt }
 *   POST /api/account/link/redeem-preview  (auth) {code} -> preview, no commit
 *   POST /api/account/link/commit          (auth) {ticketId} -> { token, uid }
 *   POST /api/account/unlink        (fresh auth) {secondaryUid} -> { ok }
 */
import type { Request, Response } from "express";
import { getAuthedClaims, requireFreshUid, requireUid } from "../auth/requireAuth.js";
import { checkRateLimit } from "../shared/rateLimit.js";
import { commitLink, createLinkCode, previewLinkCode, unlinkAccount } from "./store.js";

const LINK_START_LIMIT = 5;
const LINK_START_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const LINK_REDEEM_LIMIT = 10;
const LINK_REDEEM_WINDOW_MS = 60 * 60 * 1000;

export async function handleLinkStart(req: Request, res: Response): Promise<void> {
  const claims = await getAuthedClaims(req);
  if (!claims) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const allowed = await checkRateLimit("link-start", claims.uid, LINK_START_LIMIT, LINK_START_WINDOW_MS);
  if (!allowed) {
    res.status(429).json({ error: "Too many codes requested — try again later." });
    return;
  }
  const result = await createLinkCode(claims.uid, claims.provider);
  res.status(200).json(result);
}

export async function handleLinkRedeemPreview(req: Request, res: Response): Promise<void> {
  const claims = await getAuthedClaims(req);
  if (!claims) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const code = String(req.body?.code || "").trim();
  if (!code) {
    res.status(400).json({ error: "A code is required" });
    return;
  }
  const allowed = await checkRateLimit("link-redeem", claims.uid, LINK_REDEEM_LIMIT, LINK_REDEEM_WINDOW_MS);
  if (!allowed) {
    res.status(429).json({ error: "Too many attempts — try again later." });
    return;
  }
  const result = await previewLinkCode(code, claims.uid, claims.provider);
  res.status(result.ok ? 200 : 400).json(result);
}

export async function handleLinkCommit(req: Request, res: Response): Promise<void> {
  const uid = await requireUid(req, res);
  if (!uid)
    return;
  const ticketId = String(req.body?.ticketId || "");
  if (!ticketId) {
    res.status(400).json({ error: "A ticketId is required" });
    return;
  }
  const result = await commitLink(ticketId);
  res.status(result.ok ? 200 : 400).json(result);
}

export async function handleUnlink(req: Request, res: Response): Promise<void> {
  const canonicalUid = await requireFreshUid(req, res);
  if (!canonicalUid)
    return;
  const secondaryUid = String(req.body?.secondaryUid || "");
  if (!secondaryUid) {
    res.status(400).json({ error: "A secondaryUid is required" });
    return;
  }
  const result = await unlinkAccount(canonicalUid, secondaryUid);
  res.status(result.ok ? 200 : 400).json(result);
}
