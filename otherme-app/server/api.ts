/**
 * Dev-server API middleware — keeps all AI keys server-side.
 * Routes (all POST, JSON bodies, images as base64 data — no multipart):
 *   /api/analyze-character  Gemini vision -> 30-field character sheet JSON
 *   /api/generate-sheet     OpenAI gpt-image-2 -> character sheet image
 *   /api/gemini-token       ephemeral Gemini Live token (voice roleplay)
 *   /api/generate-avatar    OpenAI -> 3x2 talking sprite + personality profile
 *
 * Production note: move these to a real Node host unchanged; the handlers
 * only depend on fetch/FormData/Blob and process env.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { loadEnv } from 'vite'

const MAX_BODY_BYTES = 25 * 1024 * 1024
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

let env: Record<string, string> = {}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large (max 25 MB)'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      }
      catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

/* ------------------------------------------------------------------ */
/* Temporary file share: WebView download fallback                     */
/* ------------------------------------------------------------------ */

// The Nimiq Pay WebView supports neither anchor downloads nor the Web Share
// API, so the client uploads the file here and shows the user a short-lived
// link to open in a real browser (where downloading works).
const SHARE_TTL_MS = 30 * 60 * 1000
const SHARE_MAX_ENTRIES = 40
const shareStore = new Map<string, { bytes: Buffer, type: string, filename: string, at: number }>()

function sweepShareStore(): void {
  const now = Date.now()
  for (const [id, entry] of shareStore) {
    if (now - entry.at > SHARE_TTL_MS)
      shareStore.delete(id)
  }
  while (shareStore.size > SHARE_MAX_ENTRIES) {
    const oldest = shareStore.keys().next().value
    if (!oldest)
      break
    shareStore.delete(oldest)
  }
}

function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('File too large to share (max 25 MB)'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function createShare(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const bytes = await readRawBody(req)
  if (!bytes.length)
    return send(res, 400, { error: 'Empty file' })
  sweepShareStore()
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  const filename = decodeURIComponent(String(req.headers['x-filename'] || 'download')).replace(/[/\\"\r\n]/g, '-').slice(0, 120)
  shareStore.set(id, {
    bytes,
    type: String(req.headers['content-type'] || 'application/octet-stream'),
    filename,
    at: Date.now(),
  })
  send(res, 200, { url: `/api/share/${id}`, expiresInMinutes: SHARE_TTL_MS / 60000 })
}

function serveShare(id: string, res: ServerResponse): void {
  sweepShareStore()
  const entry = shareStore.get(id)
  if (!entry) {
    return send(res, 404, { error: 'This download link has expired — generate it again from the app.' })
  }
  res.statusCode = 200
  res.setHeader('Content-Type', entry.type)
  res.setHeader('Content-Length', entry.bytes.length)
  res.setHeader('Content-Disposition', `attachment; filename="${entry.filename}"`)
  res.end(entry.bytes)
}

/* ------------------------------------------------------------------ */
/* Character sheet: Gemini vision analysis                             */
/* ------------------------------------------------------------------ */

const SHEET_FIELDS = [
  'name', 'alias', 'age', 'height', 'build', 'ethnicity', 'structure', 'skin', 'eyes', 'hair', 'features',
  'traits', 'conflict', 'patterns', 'baseline', 'bodyLanguage', 'rhythm', 'idle',
  'garment1', 'garment2', 'layering', 'footwear', 'accessories', 'props',
  'environment', 'lighting', 'colorTone', 'expression', 'camera', 'style',
] as const

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
`

async function analyzeCharacter(body: any, res: ServerResponse): Promise<void> {
  const apiKey = env.GEMINI_API_KEY
  if (!apiKey)
    return send(res, 503, { error: 'GEMINI_API_KEY is not configured', demo: true })
  const { imageBase64, mimeType } = body
  if (!imageBase64)
    return send(res, 400, { error: 'imageBase64 is required' })

  const properties: Record<string, { type: string }> = {}
  for (const field of SHEET_FIELDS) properties[field] = { type: 'STRING' }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
  const payload = {
    contents: [{
      parts: [
        { text: ANALYSIS_PROMPT },
        { inlineData: { mimeType: mimeType || 'image/png', data: imageBase64 } },
      ],
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT', properties, required: [...SHEET_FIELDS] },
    },
  }

  let delay = 1000
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (response.ok) {
      const result = await response.json() as any
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text)
        return send(res, 502, { error: 'Gemini returned an empty response' })
      try {
        return send(res, 200, { sheet: JSON.parse(text) })
      }
      catch {
        return send(res, 502, { error: 'Gemini returned malformed JSON' })
      }
    }
    if (!RETRYABLE_STATUS.has(response.status) || attempt === 3) {
      const details = await response.text()
      return send(res, response.status, { error: `Gemini analysis failed (${response.status}): ${details.slice(0, 300)}` })
    }
    await pause(delay)
    delay *= 2
  }
}

/* ------------------------------------------------------------------ */
/* Character sheet: OpenAI image generation                            */
/* ------------------------------------------------------------------ */

async function generateSheet(body: any, res: ServerResponse): Promise<void> {
  const apiKey = env.OPENAI_API_KEY
  if (!apiKey)
    return send(res, 503, { error: 'OPENAI_API_KEY is not configured', demo: true })
  const { prompt, referenceImageBase64, referenceMimeType, referenceImages } = body
  if (!prompt)
    return send(res, 400, { error: 'prompt is required' })

  // Normalize references: new multi-image array (max 3) or the legacy single field.
  const references: Array<{ base64: string, mimeType: string }> = Array.isArray(referenceImages)
    ? referenceImages
        .filter((item: any) => item?.base64)
        .slice(0, 3)
        .map((item: any) => ({ base64: item.base64, mimeType: item.mimeType || 'image/png' }))
    : referenceImageBase64
      ? [{ base64: referenceImageBase64, mimeType: referenceMimeType || 'image/png' }]
      : []

  const model = env.OPENAI_IMAGE_MODEL || 'gpt-image-2'
  let endpoint = 'https://api.openai.com/v1/images/generations'
  let requestInit: RequestInit

  if (references.length) {
    // With reference images, use edits for identity fidelity (image[] = multi-reference).
    endpoint = 'https://api.openai.com/v1/images/edits'
    const form = new FormData()
    form.append('model', model)
    for (const [index, reference] of references.entries()) {
      const bytes = Buffer.from(reference.base64, 'base64')
      form.append('image[]', new Blob([bytes], { type: reference.mimeType }), `reference-${index}.png`)
    }
    form.append('prompt', String(prompt).slice(0, 30000))
    form.append('size', '1536x1024')
    form.append('quality', 'medium')
    form.append('output_format', 'webp')
    requestInit = { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form }
  }
  else {
    requestInit = {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: String(prompt).slice(0, 30000),
        size: '1536x1024',
        quality: 'medium',
        output_format: 'webp',
      }),
    }
  }

  let response: Response | null = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(endpoint, requestInit)
    if (!RETRYABLE_STATUS.has(response.status) || attempt === 2)
      break
    await pause(900 * (attempt + 1))
  }
  if (!response!.ok) {
    const details = await response!.text()
    if (response!.status === 400 && /safety|moderation/i.test(details))
      return send(res, 400, { error: 'A reference image was blocked by the image provider\'s content safety filter. Remove or replace a reference image and try again.' })
    return send(res, response!.status, { error: `Image generation failed (${response!.status}): ${details.slice(0, 300)}` })
  }
  const result = await response!.json() as { data?: Array<{ b64_json?: string }> }
  const imageBase64 = result.data?.[0]?.b64_json
  if (!imageBase64)
    return send(res, 502, { error: 'The image model returned no image data' })
  send(res, 200, { imageBase64, mimeType: 'image/webp' })
}

/* ------------------------------------------------------------------ */
/* Roleplay: ephemeral Gemini Live token                               */
/* ------------------------------------------------------------------ */

async function geminiToken(res: ServerResponse): Promise<void> {
  const apiKey = env.GEMINI_API_KEY
  if (!apiKey)
    return send(res, 503, { error: 'GEMINI_API_KEY is not configured', demo: true })
  try {
    const { GoogleGenAI } = await import('@google/genai')
    const client = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } })
    const now = Date.now()
    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        httpOptions: { apiVersion: 'v1alpha' },
      },
    })
    send(res, 200, { token: token.name, expiresIn: 1800 })
  }
  catch (error) {
    send(res, 500, { error: error instanceof Error ? error.message : 'Unable to create a Live API token' })
  }
}

/* ------------------------------------------------------------------ */
/* Roleplay: talking-avatar sprite + personality (ported from Aeternum)*/
/* ------------------------------------------------------------------ */

type SpriteSubject = 'human' | 'object'

function createSpritePrompt(subject: SpriteSubject): string {
  const direction = subject === 'object'
    ? `SUBJECT: The reference is a non-human object. Turn that exact object into a polished, family-friendly 3D animated-film character. Preserve its recognisable silhouette, construction, materials, colours and defining details. Do not generate a person, a human body, human clothing, or replace the object with a humanoid. Add only a subtle expressive face and speaking mouth naturally integrated into the object; do not add limbs unless they are already part of the object.`
    : `SUBJECT: The reference is a human or humanoid character. Create a realistic humanoid talking avatar that preserves their visible identity, anatomy, clothing and styling.`

  return `Create one exact 3x2 talking-avatar sprite sheet from the supplied character reference sheet.
Canvas: 1536x1024, six equal 512x512 cells, no gaps, no borders, no text.
${direction}
Pose: centered, front-facing portrait of the selected subject, identically framed in every cell. Use a perfectly flat, solid chroma-key green background (#00FF00) with no gradient, texture, scenery, floor, cast shadow or glow. Do not use this exact green in the subject or its details.
Cells in reading order: 1 mouth closed, 2 slightly open, 3 medium open, 4 wide open, 5 rounded O, 6 friendly open-mouth smile.
STRICT LOCK: preserve the selected subject's identity, geometry, orientation, material, lighting and framing. Only the mouth and minimal facial movement needed for speech may change. Do not create six different poses or expressions. Do not add any backdrop beyond the required flat chroma-key green, floor, shadow rectangle or scenery.`
}

async function inferProfile(apiKey: string, imageBase64: string, mimeType: string, fallbackName: string, subject: SpriteSubject): Promise<any> {
  try {
    const dataUrl = `data:${mimeType};base64,${imageBase64}`
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.OPENAI_PROFILE_MODEL || 'gpt-4.1-mini',
        input: [{
          role: 'user',
          content: [
            { type: 'input_image', image_url: dataUrl },
            { type: 'input_text', text: `Read this ${subject === 'object' ? 'object' : 'human or humanoid character'} reference. Return only compact JSON with keys name, alias, summary, systemPrompt, gender. The systemPrompt must make a real-time roleplay voice agent embody the visible personality, lore, behavior and speaking style while staying in character. gender must be exactly "female", "male" or "object" based on the subject's visible presentation${subject === 'object' ? ' (this subject is an object, so gender must be "object")' : ''}. ${subject === 'object' ? 'The subject is an object: do not describe it as human or invent a human identity.' : ''} Use ${fallbackName || 'the visible name'} when uncertain.` },
          ],
        }],
      }),
    })
    if (!response.ok)
      throw new Error('Profile inference failed')
    const json = await response.json() as { output_text?: string, output?: Array<{ content?: Array<{ text?: string }> }> }
    const raw = json.output_text || json.output?.flatMap(item => item.content || []).map(part => part.text || '').join('') || ''
    const match = raw.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : null
  }
  catch {
    return null
  }
}

async function generateAvatar(body: any, res: ServerResponse): Promise<void> {
  const apiKey = env.OPENAI_API_KEY
  if (!apiKey)
    return send(res, 503, { error: 'OPENAI_API_KEY is not configured', demo: true })

  const { imageBase64, mimeType, name: rawName, subjectType } = body
  if (!imageBase64)
    return send(res, 400, { error: 'A character reference image is required' })
  const name = String(rawName || 'New Character').slice(0, 80)
  const subject: SpriteSubject = subjectType === 'object' ? 'object' : 'human'
  const imageType = String(mimeType || 'image/png')
  if (!imageType.startsWith('image/'))
    return send(res, 400, { error: 'Use a PNG, JPG or WEBP image' })

  const imageModel = env.OPENAI_IMAGE_MODEL || 'gpt-image-2'
  const editForm = new FormData()
  editForm.append('model', imageModel)
  const bytes = Buffer.from(imageBase64, 'base64')
  editForm.append('image', new Blob([bytes], { type: imageType }), 'reference.png')
  editForm.append('prompt', createSpritePrompt(subject))
  editForm.append('size', '1536x1024')
  editForm.append('quality', 'medium')
  // GPT Image 2 rejects input_fidelity; keep it only for compatible predecessors.
  if (imageModel === 'gpt-image-1' || imageModel === 'gpt-image-1.5')
    editForm.append('input_fidelity', 'high')
  editForm.append('output_format', 'webp')

  const createSprite = async (): Promise<Response> => {
    let response: Response | null = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: editForm,
      })
      if (!RETRYABLE_STATUS.has(response.status) || attempt === 2)
        return response
      await pause(700 * (attempt + 1))
    }
    return response!
  }

  try {
    const [imageResponse, profile] = await Promise.all([
      createSprite(),
      inferProfile(apiKey, imageBase64, imageType, name, subject),
    ])

    if (!imageResponse.ok) {
      const details = await imageResponse.text()
      if (RETRYABLE_STATUS.has(imageResponse.status))
        return send(res, 503, { error: 'GPT Image is temporarily unavailable after retrying. Please try again in a minute.' })
      if (imageResponse.status === 400 && /safety|moderation/i.test(details))
        return send(res, 400, { error: 'This reference image was blocked by the image provider\'s content safety filter. Try a different image.' })
      return send(res, imageResponse.status, { error: `GPT Image request failed (${imageResponse.status}): ${details.slice(0, 300)}` })
    }
    const result = await imageResponse.json() as { data?: Array<{ b64_json?: string }> }
    const spriteBase64 = result.data?.[0]?.b64_json
    if (!spriteBase64)
      return send(res, 502, { error: 'GPT Image returned no image data' })

    send(res, 200, {
      spriteDataUrl: `data:image/webp;base64,${spriteBase64}`,
      profile: profile || {
        name,
        alias: 'The Newcomer',
        summary: 'A mysterious traveler whose story is still unfolding.',
        systemPrompt: `You are ${name}, a cinematic roleplaying character. Stay in character, respond naturally and keep spoken turns concise.`,
      },
    })
  }
  catch (error) {
    send(res, 500, { error: error instanceof Error ? error.message : 'Avatar generation failed' })
  }
}

/* ------------------------------------------------------------------ */
/* Video generation: gemini-omni-flash-preview via the Interactions API */
/* ------------------------------------------------------------------ */

const VIDEO_MODEL = 'gemini-omni-flash-preview'
const VIDEO_POLL_MS = 5000
const VIDEO_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Body: { prompt, previousInteractionId?, referenceImages? } — reference
 * images (max 3) anchor character identity; previousInteractionId enables
 * conversational edits (the client enforces the edit cap).
 * Returns { videoBase64, mimeType, interactionId }.
 */
async function generateVideo(body: any, res: ServerResponse): Promise<void> {
  const apiKey = env.GEMINI_API_KEY
  if (!apiKey)
    return send(res, 503, { error: 'GEMINI_API_KEY is not configured', demo: true })
  const { prompt, previousInteractionId, referenceImages } = body
  if (!prompt)
    return send(res, 400, { error: 'prompt is required' })

  const references = (Array.isArray(referenceImages) ? referenceImages : [])
    .filter((item: any) => item?.base64)
    .slice(0, 3)

  try {
    const { GoogleGenAI } = await import('@google/genai')
    const ai = new GoogleGenAI({ apiKey })
    const text = String(prompt).slice(0, 8000)
    const input = references.length
      ? [
          ...references.map((item: any) => ({ type: 'image', data: item.base64, mime_type: item.mimeType || 'image/png' })),
          { type: 'text', text },
        ]
      : text
    const params: Record<string, unknown> = { model: VIDEO_MODEL, input }
    if (previousInteractionId)
      params.previous_interaction_id = String(previousInteractionId)

    let interaction = await (ai as any).interactions.create(params)
    const startedAt = Date.now()
    while (['queued', 'in_progress', 'requires_action'].includes(interaction.status) && Date.now() - startedAt < VIDEO_TIMEOUT_MS) {
      await pause(VIDEO_POLL_MS)
      interaction = await (ai as any).interactions.get(interaction.id)
    }
    if (interaction.status !== 'completed')
      return send(res, 502, { error: `Video generation ended with status "${interaction.status}"` })

    const contents = (interaction.steps || []).flatMap((step: any) => step.content || [])
    const video = contents.find((item: any) => item.type === 'video' && (item.data || item.uri))
    if (!video)
      return send(res, 502, { error: 'The model returned no video output' })

    let videoBase64 = video.data as string | undefined
    if (!videoBase64 && video.uri) {
      const download = await fetch(video.uri)
      if (!download.ok)
        return send(res, 502, { error: `Could not download the generated video (${download.status})` })
      videoBase64 = Buffer.from(await download.arrayBuffer()).toString('base64')
    }
    send(res, 200, { videoBase64, mimeType: video.mime_type || 'video/mp4', interactionId: interaction.id })
  }
  catch (error) {
    send(res, 500, { error: error instanceof Error ? error.message.slice(0, 400) : 'Video generation failed' })
  }
}

/* ------------------------------------------------------------------ */
/* Plugin                                                              */
/* ------------------------------------------------------------------ */

export function apiPlugin(): Plugin {
  return {
    name: 'otherme-api',
    config(_config, { mode }) {
      env = loadEnv(mode, process.cwd(), '')
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (!url.startsWith('/api/'))
          return next()

        // Share links are fetched by a plain browser tab (GET, raw bytes).
        if (req.method === 'GET' && url.startsWith('/api/share/'))
          return serveShare(url.slice('/api/share/'.length), res)

        if (req.method !== 'POST')
          return send(res, 405, { error: 'Method not allowed' })

        try {
          if (url === '/api/share')
            return await createShare(req, res)
          if (url === '/api/gemini-token')
            return await geminiToken(res)
          const body = await readBody(req)
          if (url === '/api/analyze-character')
            return await analyzeCharacter(body, res)
          if (url === '/api/generate-sheet')
            return await generateSheet(body, res)
          if (url === '/api/generate-avatar')
            return await generateAvatar(body, res)
          if (url === '/api/generate-video')
            return await generateVideo(body, res)
          send(res, 404, { error: 'Unknown API route' })
        }
        catch (error) {
          send(res, 500, { error: error instanceof Error ? error.message : 'Server error' })
        }
      })
    },
  }
}
