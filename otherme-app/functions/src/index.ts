/**
 * Other Me — Cloud Functions API (production).
 *
 * Port of the dev-only Vite middleware in ../server/api.ts. Keep the two in
 * sync: server/api.ts serves /api/* during `npm run dev`; this function serves
 * the same routes in production behind the Hosting rewrite (/api/** -> api).
 *
 * Keys are Secret Manager secrets (GEMINI_API_KEY, OPENAI_API_KEY), never in
 * the bundle. The share route uploads to Firebase Storage and returns a
 * time-tokened download URL (the Nimiq Pay WebView download fallback).
 */
import { onRequest } from "firebase-functions/https";
import { onSchedule } from "firebase-functions/scheduler";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions";
import express, { type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { handleGrantCredits } from "./admin/routes.js";
import { handleLinkCommit, handleLinkRedeemPreview, handleLinkStart, handleUnlink } from "./account/routes.js";
import { handleAccountResolve, handleAuthChallenge, handleAuthVerify } from "./auth/routes.js";
import { getAuthedUid } from "./auth/requireAuth.js";
import { handleAcceptTerms, handleBalance, handleMigrate, handleRecordPurchase, handleSpend } from "./credits/routes.js";
import { handleClaimOrder, handleCreateOrder } from "./orders/routes.js";
import { runReconcile } from "./reconciler/reconcile.js";
import { checkRateLimit } from "./shared/rateLimit.js";

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

// Phase 4 reconciler RPC config, read from process.env at runtime. A secret is
// only injected into process.env when it's listed in the schedule's `secrets`
// array below AND exists in Secret Manager, so RECONCILE_SECRETS lists only the
// secrets that currently exist (comma-separated env RECONCILE_SECRET_NAMES set
// at deploy). Ships empty: USDT uses the public Polygon RPC default and NIM
// stays dormant until our Nimiq node RPC secrets are created. To enable a
// private Polygon RPC or NIM, create the secret(s) — POLYGON_RPC_URL,
// NIMIQ_RPC_URL, NIMIQ_RPC_USER, NIMIQ_RPC_PASS — then add their names here and
// redeploy.
const RECONCILE_SECRETS = ([] as string[]).map(name => defineSecret(name));

if (!getApps().length) {
  initializeApp();
}

setGlobalOptions({ maxInstances: 10 });

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function send(res: Response, status: number, payload: unknown): void {
  res.status(status).json(payload);
}

/* ------------------------------------------------------------------ */
/* Character sheet: Gemini vision analysis                             */
/* ------------------------------------------------------------------ */

const SHEET_FIELDS = [
  "name", "alias", "age", "height", "build", "ethnicity", "structure", "skin", "eyes", "hair", "features",
  "traits", "conflict", "patterns", "baseline", "bodyLanguage", "rhythm", "idle",
  "garment1", "garment2", "layering", "footwear", "accessories", "props",
  "environment", "lighting", "colorTone", "expression", "camera", "style",
] as const;

const ANALYSIS_PROMPT = `
You are an expert film-production character designer and casting director.
Analyze the uploaded character design / portrait image. Dissect the visual elements and return a highly detailed character design sheet conforming exactly to the structured layout.
Generate creative, highly descriptive, industry-grade terminology for every field. If the image is a portrait, use logical creative extrapolation to fill out the clothing, shoes, props, and psychological profiles that perfectly match the visual aesthetic, genre, and lighting of the reference image.
Field meanings:
- name: creative cinematic full name | alias: nickname or codename | age: real or stylized | height: metric or imperial
- build: body type, posture, proportions | ethnicity: design/style language (e.g. "Pixar-style stylized realism")
- structure: head shape, bone structure | skin: texture, color, micro-imperfections | eyes: size, glow, expression | hair: style, volume, movement | features: unique traits (scars, markings)
- traits: 3-5 personality traits | conflict: internal desire vs roadblock | patterns: 3 revealing physical habits | baseline: core emotional state
- bodyLanguage: posture defaults | rhythm: movement style | idle: fidgeting or stillness habits
- garment1: top clothing fabric/wear | garment2: bottom clothing fit | layering: outerwear draping | footwear: material and wear | accessories: lore-revealing items | props: handheld gear
- environment: cinematic home location | lighting: pro cinematographic setup | colorTone: palette | expression: specific micro-expression | camera: lens and depth of field | style: overall artistic direction
`;

async function analyzeCharacter(body: any, res: Response): Promise<void> {
  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey)
    return send(res, 503, { error: "GEMINI_API_KEY is not configured", demo: true });
  const { imageBase64, mimeType } = body;
  if (!imageBase64)
    return send(res, 400, { error: "imageBase64 is required" });

  const properties: Record<string, { type: string }> = {};
  for (const field of SHEET_FIELDS) properties[field] = { type: "STRING" };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{
      parts: [
        { text: ANALYSIS_PROMPT },
        { inlineData: { mimeType: mimeType || "image/png", data: imageBase64 } },
      ],
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: { type: "OBJECT", properties, required: [...SHEET_FIELDS] },
    },
  };

  let delay = 1000;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const result = await response.json() as any;
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text)
        return send(res, 502, { error: "Gemini returned an empty response" });
      try {
        return send(res, 200, { sheet: JSON.parse(text) });
      }
      catch {
        return send(res, 502, { error: "Gemini returned malformed JSON" });
      }
    }
    if (!RETRYABLE_STATUS.has(response.status) || attempt === 3) {
      const details = await response.text();
      return send(res, response.status, { error: `Gemini analysis failed (${response.status}): ${details.slice(0, 300)}` });
    }
    await pause(delay);
    delay *= 2;
  }
}

/* ------------------------------------------------------------------ */
/* Character sheet: OpenAI image generation                            */
/* ------------------------------------------------------------------ */

async function generateSheet(body: any, res: Response): Promise<void> {
  const apiKey = OPENAI_API_KEY.value();
  if (!apiKey)
    return send(res, 503, { error: "OPENAI_API_KEY is not configured", demo: true });
  const { prompt, referenceImageBase64, referenceMimeType, referenceImages } = body;
  if (!prompt)
    return send(res, 400, { error: "prompt is required" });

  // Normalize references: new multi-image array (max 3) or the legacy single field.
  const references: Array<{ base64: string, mimeType: string }> = Array.isArray(referenceImages)
    ? referenceImages
        .filter((item: any) => item?.base64)
        .slice(0, 3)
        .map((item: any) => ({ base64: item.base64, mimeType: item.mimeType || "image/png" }))
    : referenceImageBase64
      ? [{ base64: referenceImageBase64, mimeType: referenceMimeType || "image/png" }]
      : [];

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  let endpoint = "https://api.openai.com/v1/images/generations";
  let requestInit: RequestInit;

  if (references.length) {
    // With reference images, use edits for identity fidelity (image[] = multi-reference).
    endpoint = "https://api.openai.com/v1/images/edits";
    const form = new FormData();
    form.append("model", model);
    for (const [index, reference] of references.entries()) {
      const bytes = Buffer.from(reference.base64, "base64");
      form.append("image[]", new Blob([bytes], { type: reference.mimeType }), `reference-${index}.png`);
    }
    form.append("prompt", String(prompt).slice(0, 30000));
    form.append("size", "1536x1024");
    form.append("quality", "medium");
    form.append("output_format", "webp");
    requestInit = { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form };
  }
  else {
    requestInit = {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: String(prompt).slice(0, 30000),
        size: "1536x1024",
        quality: "medium",
        output_format: "webp",
      }),
    };
  }

  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(endpoint, requestInit) as unknown as Response;
    if (!RETRYABLE_STATUS.has((response as any).status) || attempt === 2)
      break;
    await pause(900 * (attempt + 1));
  }
  const httpResponse = response as unknown as globalThis.Response;
  if (!httpResponse.ok) {
    const details = await httpResponse.text();
    if (httpResponse.status === 400 && /safety|moderation/i.test(details))
      return send(res, 400, { error: "A reference image was blocked by the image provider's content safety filter. Remove or replace a reference image and try again." });
    return send(res, httpResponse.status, { error: `Image generation failed (${httpResponse.status}): ${details.slice(0, 300)}` });
  }
  const result = await httpResponse.json() as { data?: Array<{ b64_json?: string }> };
  const imageBase64 = result.data?.[0]?.b64_json;
  if (!imageBase64)
    return send(res, 502, { error: "The image model returned no image data" });
  send(res, 200, { imageBase64, mimeType: "image/webp" });
}

/* ------------------------------------------------------------------ */
/* Roleplay: ephemeral Gemini Live token                               */
/* ------------------------------------------------------------------ */

async function geminiToken(res: Response): Promise<void> {
  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey)
    return send(res, 503, { error: "GEMINI_API_KEY is not configured", demo: true });
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const client = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1alpha" } });
    const now = Date.now();
    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        httpOptions: { apiVersion: "v1alpha" },
      },
    });
    send(res, 200, { token: token.name, expiresIn: 1800 });
  }
  catch (error) {
    send(res, 500, { error: error instanceof Error ? error.message : "Unable to create a Live API token" });
  }
}

/* ------------------------------------------------------------------ */
/* Roleplay: talking-avatar sprite + personality (ported from Aeternum)*/
/* ------------------------------------------------------------------ */

type SpriteSubject = "human" | "object";

function createSpritePrompt(subject: SpriteSubject): string {
  const direction = subject === "object"
    ? `SUBJECT: The reference is a non-human object. Turn that exact object into a polished, family-friendly 3D animated-film character. Preserve its recognisable silhouette, construction, materials, colours and defining details. Do not generate a person, a human body, human clothing, or replace the object with a humanoid. Add only a subtle expressive face and speaking mouth naturally integrated into the object; do not add limbs unless they are already part of the object.`
    : `SUBJECT: The reference is a human or humanoid character. Create a realistic humanoid talking avatar that preserves their visible identity, anatomy, clothing and styling.`;

  return `Create one exact 3x2 talking-avatar sprite sheet from the supplied character reference sheet.
Canvas: 1536x1024, six equal 512x512 cells, no gaps, no borders, no text.
${direction}
Pose: centered, front-facing portrait of the selected subject, identically framed in every cell. Use a perfectly flat, solid chroma-key green background (#00FF00) with no gradient, texture, scenery, floor, cast shadow or glow. Do not use this exact green in the subject or its details.
Cells in reading order: 1 mouth closed, 2 slightly open, 3 medium open, 4 wide open, 5 rounded O, 6 friendly open-mouth smile.
STRICT LOCK: preserve the selected subject's identity, geometry, orientation, material, lighting and framing. Only the mouth and minimal facial movement needed for speech may change. Do not create six different poses or expressions. Do not add any backdrop beyond the required flat chroma-key green, floor, shadow rectangle or scenery.`;
}

async function inferProfile(apiKey: string, imageBase64: string, mimeType: string, fallbackName: string, subject: SpriteSubject): Promise<any> {
  try {
    const dataUrl = `data:${mimeType};base64,${imageBase64}`;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_PROFILE_MODEL || "gpt-4.1-mini",
        input: [{
          role: "user",
          content: [
            { type: "input_image", image_url: dataUrl },
            { type: "input_text", text: `Read this ${subject === "object" ? "object" : "human or humanoid character"} reference. Return only compact JSON with keys name, alias, summary, systemPrompt, gender. The systemPrompt must make a real-time roleplay voice agent embody the visible personality, lore, behavior and speaking style while staying in character. gender must be exactly "female", "male" or "object" based on the subject's visible presentation${subject === "object" ? " (this subject is an object, so gender must be \"object\")" : ""}. ${subject === "object" ? "The subject is an object: do not describe it as human or invent a human identity." : ""} Use ${fallbackName || "the visible name"} when uncertain.` },
          ],
        }],
      }),
    });
    if (!response.ok)
      throw new Error("Profile inference failed");
    const json = await response.json() as { output_text?: string, output?: Array<{ content?: Array<{ text?: string }> }> };
    const raw = json.output_text || json.output?.flatMap((item) => item.content || []).map((part) => part.text || "").join("") || "";
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
  catch {
    return null;
  }
}

async function generateAvatar(body: any, res: Response): Promise<void> {
  const apiKey = OPENAI_API_KEY.value();
  if (!apiKey)
    return send(res, 503, { error: "OPENAI_API_KEY is not configured", demo: true });

  const { imageBase64, mimeType, name: rawName, subjectType } = body;
  if (!imageBase64)
    return send(res, 400, { error: "A character reference image is required" });
  const name = String(rawName || "New Character").slice(0, 80);
  const subject: SpriteSubject = subjectType === "object" ? "object" : "human";
  const imageType = String(mimeType || "image/png");
  if (!imageType.startsWith("image/"))
    return send(res, 400, { error: "Use a PNG, JPG or WEBP image" });

  const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const editForm = new FormData();
  editForm.append("model", imageModel);
  const bytes = Buffer.from(imageBase64, "base64");
  editForm.append("image", new Blob([bytes], { type: imageType }), "reference.png");
  editForm.append("prompt", createSpritePrompt(subject));
  editForm.append("size", "1536x1024");
  editForm.append("quality", "medium");
  // GPT Image 2 rejects input_fidelity; keep it only for compatible predecessors.
  if (imageModel === "gpt-image-1" || imageModel === "gpt-image-1.5")
    editForm.append("input_fidelity", "high");
  editForm.append("output_format", "webp");

  const createSprite = async (): Promise<globalThis.Response> => {
    let response: globalThis.Response | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: editForm,
      });
      if (!RETRYABLE_STATUS.has(response.status) || attempt === 2)
        return response;
      await pause(700 * (attempt + 1));
    }
    return response!;
  };

  try {
    const [imageResponse, profile] = await Promise.all([
      createSprite(),
      inferProfile(apiKey, imageBase64, imageType, name, subject),
    ]);

    if (!imageResponse.ok) {
      const details = await imageResponse.text();
      if (RETRYABLE_STATUS.has(imageResponse.status))
        return send(res, 503, { error: "GPT Image is temporarily unavailable after retrying. Please try again in a minute." });
      if (imageResponse.status === 400 && /safety|moderation/i.test(details))
        return send(res, 400, { error: "This reference image was blocked by the image provider's content safety filter. Try a different image." });
      return send(res, imageResponse.status, { error: `GPT Image request failed (${imageResponse.status}): ${details.slice(0, 300)}` });
    }
    const result = await imageResponse.json() as { data?: Array<{ b64_json?: string }> };
    const spriteBase64 = result.data?.[0]?.b64_json;
    if (!spriteBase64)
      return send(res, 502, { error: "GPT Image returned no image data" });

    send(res, 200, {
      spriteDataUrl: `data:image/webp;base64,${spriteBase64}`,
      profile: profile || {
        name,
        alias: "The Newcomer",
        summary: "A mysterious traveler whose story is still unfolding.",
        systemPrompt: `You are ${name}, a cinematic roleplaying character. Stay in character, respond naturally and keep spoken turns concise.`,
      },
    });
  }
  catch (error) {
    send(res, 500, { error: error instanceof Error ? error.message : "Avatar generation failed" });
  }
}

/* ------------------------------------------------------------------ */
/* Video generation: gemini-omni-flash-preview via the Interactions API */
/* ------------------------------------------------------------------ */

const VIDEO_MODEL = "gemini-omni-flash-preview";
const VIDEO_POLL_MS = 5000;
const VIDEO_TIMEOUT_MS = 5 * 60 * 1000;

async function generateVideo(body: any, res: Response): Promise<void> {
  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey)
    return send(res, 503, { error: "GEMINI_API_KEY is not configured", demo: true });
  const { prompt, previousInteractionId, referenceImages } = body;
  if (!prompt)
    return send(res, 400, { error: "prompt is required" });

  const references = (Array.isArray(referenceImages) ? referenceImages : [])
    .filter((item: any) => item?.base64)
    .slice(0, 3);

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const text = String(prompt).slice(0, 8000);
    const input = references.length
      ? [
          ...references.map((item: any) => ({ type: "image", data: item.base64, mime_type: item.mimeType || "image/png" })),
          { type: "text", text },
        ]
      : text;
    const params: Record<string, unknown> = { model: VIDEO_MODEL, input };
    if (previousInteractionId)
      params.previous_interaction_id = String(previousInteractionId);

    let interaction = await (ai as any).interactions.create(params);
    const startedAt = Date.now();
    while (["queued", "in_progress", "requires_action"].includes(interaction.status) && Date.now() - startedAt < VIDEO_TIMEOUT_MS) {
      await pause(VIDEO_POLL_MS);
      interaction = await (ai as any).interactions.get(interaction.id);
    }
    if (interaction.status !== "completed")
      return send(res, 502, { error: `Video generation ended with status "${interaction.status}"` });

    const contents = (interaction.steps || []).flatMap((step: any) => step.content || []);
    const video = contents.find((item: any) => item.type === "video" && (item.data || item.uri));
    if (!video)
      return send(res, 502, { error: "The model returned no video output" });

    let videoBase64 = video.data as string | undefined;
    if (!videoBase64 && video.uri) {
      const download = await fetch(video.uri);
      if (!download.ok)
        return send(res, 502, { error: `Could not download the generated video (${download.status})` });
      videoBase64 = Buffer.from(await download.arrayBuffer()).toString("base64");
    }
    send(res, 200, { videoBase64, mimeType: video.mime_type || "video/mp4", interactionId: interaction.id });
  }
  catch (error) {
    send(res, 500, { error: error instanceof Error ? error.message.slice(0, 400) : "Video generation failed" });
  }
}

/* ------------------------------------------------------------------ */
/* File share: upload to Firebase Storage, return a tokened URL        */
/* ------------------------------------------------------------------ */

const SHARE_TTL_HOURS = 24;

async function createShare(req: Request, res: Response): Promise<void> {
  const bytes = req.body as Buffer;
  if (!bytes || !bytes.length)
    return send(res, 400, { error: "Empty file" });
  const id = `${Date.now().toString(36)}${randomUUID().slice(0, 8)}`;
  const filename = decodeURIComponent(String(req.headers["x-filename"] || "download")).replace(/[/\\"\r\n]/g, "-").slice(0, 120);
  const contentType = String(req.headers["content-type"] || "application/octet-stream");
  const token = randomUUID();
  const filePath = `shares/${id}/${filename}`;
  const bucket = getStorage().bucket();
  await bucket.file(filePath).save(bytes, {
    metadata: {
      contentType,
      contentDisposition: `attachment; filename="${filename}"`,
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
  send(res, 200, { url, expiresInMinutes: SHARE_TTL_HOURS * 60 });
}

/* ------------------------------------------------------------------ */
/* Express app + export                                                */
/* ------------------------------------------------------------------ */

const wrap = (fn: (req: Request, res: Response) => Promise<void> | void) =>
  (req: Request, res: Response): void => {
    Promise.resolve(fn(req, res)).catch((error) => {
      // Log server-side so failures are visible in Cloud Logging (the request
      // log only records the 500 status, not the cause).
      console.error(`[api] ${req.method} ${req.path} failed:`, error);
      if (!res.headersSent)
        send(res, 500, { error: error instanceof Error ? error.message : "Server error" });
    });
  };

const app = express();
// Cloud Functions gen2 runs behind Google's front end — a trusted single hop —
// so req.ip reflects the real caller IP (from X-Forwarded-For) instead of
// Google's internal address. Needed for IP-keyed rate limiting below.
app.set("trust proxy", true);

/**
 * Shared rate limit for the AI generation routes (anonymous-accessible by
 * design — the 5-free-renders flow — so this bounds paid-API-quota abuse
 * instead of gating on auth). One scope across all six routes so a script
 * can't dodge the cap by spreading calls across them.
 */
async function aiRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const uid = await getAuthedUid(req);
  const key = uid ? `uid:${uid}` : `ip:${req.ip}`;
  const allowed = await checkRateLimit("ai-generate", key, 40, 10 * 60 * 1000);
  if (!allowed) {
    res.status(429).json({ error: "Too many requests — please slow down." });
    return;
  }
  next();
}

// The production frontend calls this function cross-origin: Firebase Hosting
// caps proxied calls at 60s, too short for image/video generation, so the app
// hits the function URL directly instead of the /api Hosting rewrite. Allow the
// custom X-Filename header used by the share upload.
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  // Authorization: Bearer <idToken> is sent by the authenticated credits routes.
  res.set("Access-Control-Allow-Headers", "Content-Type, X-Filename, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  next();
});

const json = express.json({ limit: "25mb" });
const router = express.Router();

router.post("/analyze-character", json, aiRateLimit, wrap((req, res) => analyzeCharacter(req.body, res)));
router.post("/generate-sheet", json, aiRateLimit, wrap((req, res) => generateSheet(req.body, res)));
router.post("/generate-avatar", json, aiRateLimit, wrap((req, res) => generateAvatar(req.body, res)));
router.post("/generate-video", json, aiRateLimit, wrap((req, res) => generateVideo(req.body, res)));
router.post("/gemini-token", aiRateLimit, wrap((_req, res) => geminiToken(res)));
router.post("/share", express.raw({ type: () => true, limit: "25mb" }), aiRateLimit, wrap(createShare));

// Signed-challenge login (Nimiq Pay signs; server verifies). See auth/routes.ts.
router.post("/auth/challenge", json, wrap(handleAuthChallenge));
router.post("/auth/verify", json, wrap(handleAuthVerify));

// Exchange a native email/Google Firebase ID token for a canonical session
// token (Part A of account linking). See auth/routes.ts.
router.post("/account/resolve", json, wrap(handleAccountResolve));

// Account linking (Part B): pairing-code based, preview-before-commit. See
// account/routes.ts.
router.post("/account/link/start", json, wrap(handleLinkStart));
router.post("/account/link/redeem-preview", json, wrap(handleLinkRedeemPreview));
router.post("/account/link/commit", json, wrap(handleLinkCommit));
router.post("/account/unlink", json, wrap(handleUnlink));

// Server-authoritative credits ledger (Phase 2). All require a session token.
router.get("/credits/balance", wrap(handleBalance));
router.post("/credits/migrate", json, wrap(handleMigrate));
router.post("/credits/spend", json, wrap(handleSpend));
router.post("/credits/record-purchase", json, wrap(handleRecordPurchase));
router.post("/credits/accept-terms", json, wrap(handleAcceptTerms));

// Payment intents (Phase 3). The reconciler (Phase 4) verifies claimed txs.
router.post("/orders", json, wrap(handleCreateOrder));
router.post("/orders/:id/claim", json, wrap(handleClaimOrder));

// Admin-only credit grants (contest prizes, support credits). See admin/routes.ts.
router.post("/admin/grant-credits", json, wrap(handleGrantCredits));

// Mounted twice: "/api/*" for the Hosting rewrite and the run.app direct URL;
// "/*" for the cloudfunctions.net URL, which strips the function-name segment
// before the service sees the path.
app.use("/api", router);
app.use("/", router);
app.use((_req, res) => send(res, 404, { error: "Unknown API route" }));

export const api = onRequest(
  {
    memory: "1GiB",
    timeoutSeconds: 540,
    secrets: [GEMINI_API_KEY, OPENAI_API_KEY],
  },
  app,
);

/**
 * Phase 4 — scheduled on-chain reconciler. Every minute it verifies claimed
 * payments against their orders and grants credits itself (the sole granter for
 * USDT). Creating this export provisions a Cloud Scheduler job on deploy
 * (requires the Cloud Scheduler API + Blaze).
 */
export const reconcile = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "256MiB",
    secrets: RECONCILE_SECRETS,
  },
  async () => {
    const summary = await runReconcile();
    // gen2 request logs don't show return values — log so passes are visible.
    console.log("[reconcile]", JSON.stringify(summary));
  },
);

/**
 * Enforce the share-link TTL.
 *
 * `createShare` promises the client the link lasts SHARE_TTL_HOURS, but nothing
 * deleted the object — shared images and clips sat at a public URL forever while
 * the UI called them temporary. That is a disclosure problem as much as a
 * storage one (see `docs/terms-and-conditions.md` §8), so the promise is now
 * actually kept. Deliberately a separate daily job rather than work bolted onto
 * the 1-minute reconciler.
 */
export const cleanupShares = onSchedule(
  {
    schedule: "every 24 hours",
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    const cutoff = Date.now() - SHARE_TTL_HOURS * 60 * 60 * 1000;
    const [files] = await getStorage().bucket().getFiles({ prefix: "shares/" });
    let deleted = 0;
    let kept = 0;
    let undated = 0;
    for (const file of files) {
      const created = Date.parse(String(file.metadata?.timeCreated ?? ""));
      if (!Number.isFinite(created)) {
        // No timeCreated: leave it rather than risk deleting something new.
        undated++;
        continue;
      }
      if (created >= cutoff) {
        kept++;
        continue;
      }
      try {
        await file.delete();
        deleted++;
      }
      catch (error) {
        console.error("[cleanupShares] delete failed:", file.name, error);
      }
    }
    console.log("[cleanupShares]", JSON.stringify({ scanned: files.length, deleted, kept, undated }));
  },
);
