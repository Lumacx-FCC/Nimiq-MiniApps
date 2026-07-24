/**
 * Saved character sheets — localStorage for the hackathon.
 * Post-hackathon migration seam: swap these four functions for Firebase
 * (Firestore doc per sheet, Storage for the image) without touching the UI.
 */
import type { CharacterSheet } from './fields'
import { apiUrl } from '../core/api'

export interface SavedSheet {
  id: string
  name: string
  savedAt: string
  data: CharacterSheet
  imageDataUrl: string | null
}

const KEY = 'otherme:sheets'
const MAX_SHEETS = 12

export function listSheets(): SavedSheet[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as SavedSheet[]
  }
  catch {
    return []
  }
}

export function saveSheet(sheet: SavedSheet): boolean {
  const next = [sheet, ...listSheets().filter(item => item.id !== sheet.id)].slice(0, MAX_SHEETS)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
    return true
  }
  catch {
    // Quota exceeded (images are heavy) — retry without the oldest images.
    try {
      const slim = next.map((item, index) => index > 2 ? { ...item, imageDataUrl: null } : item)
      localStorage.setItem(KEY, JSON.stringify(slim))
      return true
    }
    catch {
      return false
    }
  }
}

export function deleteSheet(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(listSheets().filter(item => item.id !== id)))
}

/**
 * Downscale + re-encode an image data URL (WebP) before persisting it.
 * localStorage gives the whole app ~5 MB; full-size sheet renders are ~2 MB
 * each, which is why saving died after 2-3 characters on real phones.
 */
export async function compressImageDataUrl(dataUrl: string, maxDimension = 1024, quality = 0.82): Promise<string> {
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Could not decode image'))
      element.src = dataUrl
    })
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context)
      return dataUrl
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const compressed = canvas.toDataURL('image/webp', quality)
    return compressed.length < dataUrl.length ? compressed : dataUrl
  }
  catch {
    return dataUrl
  }
}

/** Android WebViews (Nimiq Pay) mark themselves with "wv" in the user agent. */
function isAndroidWebView(): boolean {
  return /Android/i.test(navigator.userAgent) && /\bwv\b/.test(navigator.userAgent)
}

function anchorDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * WebView fallback: upload the file to the dev/prod server and show a
 * short-lived link the user opens in a real browser, where downloads work.
 */
async function shareViaBrowserLink(blob: Blob, filename: string): Promise<void> {
  const response = await fetch(apiUrl('/api/share'), {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(filename) },
    body: blob,
  })
  const json = await response.json() as { url?: string, error?: string, expiresInMinutes?: number }
  if (!response.ok || !json.url)
    throw new Error(json.error || 'Could not create download link')
  // Prod (Cloud Function) returns an absolute Firebase Storage URL; the dev
  // Vite middleware returns a relative /api/share/:id path.
  const link = json.url.startsWith('http') ? json.url : `${window.location.origin}${json.url}`
  showBrowserLinkOverlay(link, filename, json.expiresInMinutes ?? 30)
}

/** Human expiry string from minutes (dev share = 30 min, prod = 24 h). */
function expiryLabel(minutes: number, es: boolean): string {
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60)
    return es ? `${hours} ${hours === 1 ? 'hora' : 'horas'}` : `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  }
  return es ? `${minutes} minutos` : `${minutes} minutes`
}

function showBrowserLinkOverlay(url: string, filename: string, expiresInMinutes: number): void {
  const es = localStorage.getItem('otherme:lang') === 'es'
  const expiry = expiryLabel(expiresInMinutes, es)
  // A ready-to-send message (not a bare URL) so a paste into X / WhatsApp /
  // Telegram reads as a friendly invite and carries the app link too.
  const message = es
    ? `Mira mi creación de OtherMe 👉 ${url}\n\nCrea la tuya en ${SHARE_URL}`
    : `See my OtherMe creation 👉 ${url}\n\nCreate yours at ${SHARE_URL}`
  const copy = {
    title: es ? 'Comparte tu creación' : 'Share your creation',
    body: es
      ? `Copia este mensaje y envíalo a tus amigos por X, WhatsApp o Telegram — o ábrelo en tu navegador para guardar el archivo. El enlace funciona por ${expiry}.`
      : `Copy this message and send it to friends on X, WhatsApp or Telegram — or open it in your browser to save the file. The link works for ${expiry}.`,
    copyLabel: es ? 'Copiar mensaje' : 'Copy message',
    copied: es ? '¡Copiado!' : 'Copied!',
    open: es ? 'Abrir en el navegador' : 'Open in browser',
    close: es ? 'Cerrar' : 'Close',
  }

  const overlay = document.createElement('div')
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.style.cssText = 'position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:20px;background:rgba(2,6,12,.85)'
  const card = document.createElement('div')
  card.style.cssText = 'max-width:420px;width:100%;border-radius:16px;padding:20px;background:var(--nq-card,#1f2348);color:var(--text-100,#fff);box-shadow:0 24px 70px rgba(0,0,0,.5);font-family:inherit'
  card.innerHTML = `
    <h3 style="margin:0 0 8px;font-size:16px;font-weight:800"></h3>
    <p style="margin:0 0 12px;font-size:13px;line-height:1.5;opacity:.85"></p>
    <textarea readonly rows="4" style="width:100%;box-sizing:border-box;border:none;outline:none;border-radius:10px;padding:10px;font-size:13px;line-height:1.4;resize:none;background:var(--highlight-bg,rgba(255,255,255,.08));color:inherit;font-family:inherit"></textarea>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button data-action="copy" style="flex:1;border:none;border-radius:999px;padding:11px;font-weight:700;font-size:13px;cursor:pointer;background:var(--om-cta-bg,#2ea3b4);color:#fff"></button>
      <a data-action="open" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex;align-items:center;border-radius:999px;padding:11px 16px;font-weight:700;font-size:13px;cursor:pointer;background:var(--highlight-bg,rgba(255,255,255,.1));color:inherit"></a>
    </div>
    <button data-action="close" style="width:100%;margin-top:8px;border:none;border-radius:999px;padding:10px;font-weight:700;font-size:13px;cursor:pointer;background:transparent;color:var(--text-60,rgba(255,255,255,.6))"></button>`
  card.querySelector('h3')!.textContent = copy.title
  card.querySelector('p')!.textContent = copy.body
  const textarea = card.querySelector('textarea')!
  textarea.value = message
  const copyButton = card.querySelector<HTMLButtonElement>('[data-action="copy"]')!
  copyButton.textContent = copy.copyLabel
  const openLink = card.querySelector<HTMLAnchorElement>('[data-action="open"]')!
  openLink.textContent = copy.open
  openLink.href = url
  card.querySelector<HTMLButtonElement>('[data-action="close"]')!.textContent = copy.close

  const closeOverlay = () => overlay.remove()
  overlay.addEventListener('click', event => event.target === overlay && closeOverlay())
  card.querySelector('[data-action="close"]')!.addEventListener('click', closeOverlay)
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(message)
    }
    catch {
      textarea.select()
      document.execCommand('copy')
    }
    copyButton.textContent = copy.copied
    window.setTimeout(() => { copyButton.textContent = copy.copyLabel }, 2000)
  })
  textarea.addEventListener('click', () => textarea.select())
  overlay.appendChild(card)
  document.body.appendChild(overlay)
}

/** Attribution added to shared assets so reshares point back to the app. */
export const SHARE_CAPTION = 'Created on OtherMeApp.com'
export const SHARE_URL = 'https://othermeapp.com'

async function shareOrDownloadBlob(blob: Blob, filename: string, share?: { text?: string, url?: string }): Promise<void> {
  // Preferred: the native share sheet (real mobile browsers).
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' })
  if (typeof navigator.canShare === 'function') {
    // Try to include the attribution text/url; some platforms reject files+url
    // together, so fall back to files-only.
    const full = { files: [file], title: filename, ...(share || {}) }
    const payload = navigator.canShare(full) ? full : (navigator.canShare({ files: [file] }) ? { files: [file], title: filename } : null)
    if (payload) {
      try {
        await navigator.share(payload)
        return
      }
      catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError')
          return // user closed the share sheet
        // Share unavailable after all — fall through.
      }
    }
  }
  // The Nimiq Pay WebView supports neither Web Share nor anchor downloads:
  // hand out a server link to open in a real browser instead.
  if (isAndroidWebView()) {
    try {
      await shareViaBrowserLink(blob, filename)
      return
    }
    catch { /* server unreachable — try the anchor as a last resort */ }
  }
  anchorDownload(blob, filename)
}

/**
 * Burn a small attribution footer onto an image data URL (canvas composite).
 * Reused for shared scenes/character sheets so the image itself carries the
 * "Created on OtherMeApp.com" credit. Returns the original on any failure.
 */
async function burnFooter(dataUrl: string, caption: string): Promise<string> {
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('decode'))
      element.src = dataUrl
    })
    const w = image.naturalWidth
    const h = image.naturalHeight
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx)
      return dataUrl
    ctx.drawImage(image, 0, 0, w, h)
    const barH = Math.max(24, Math.round(h * 0.06))
    const fontPx = Math.round(barH * 0.5)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, h - barH, w, barH)
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.font = `600 ${fontPx}px system-ui, sans-serif`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(caption, w / 2, h - barH / 2)
    return canvas.toDataURL('image/webp', 0.9)
  }
  catch {
    return dataUrl
  }
}

/** The best MediaRecorder container this engine can produce (prefer mp4). */
function pickVideoMime(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function')
    return null
  const candidates = ['video/mp4;codecs=h264,aac', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
  return candidates.find(m => MediaRecorder.isTypeSupported(m)) ?? null
}

/**
 * Re-encode a video data URL with the attribution footer burned onto every
 * frame (canvas compositing → MediaRecorder), preserving the source audio.
 * Runs in real time (playback duration — clips are ~8s). Returns null when the
 * platform can't record, so the caller shares the original clip + link instead.
 */
async function burnVideoFooter(dataUrl: string, caption: string): Promise<{ blob: Blob, ext: string } | null> {
  const mime = pickVideoMime()
  const canCapture = typeof HTMLCanvasElement !== 'undefined'
    && typeof (HTMLCanvasElement.prototype as unknown as { captureStream?: unknown }).captureStream === 'function'
  if (!mime || !canCapture)
    return null
  try {
    const video = document.createElement('video')
    video.src = dataUrl
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('video decode'))
    })
    const w = video.videoWidth
    const h = video.videoHeight
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx)
      return null

    const barH = Math.max(24, Math.round(h * 0.06))
    const fontPx = Math.round(barH * 0.5)

    const canvasStream = (canvas as unknown as { captureStream: (fps: number) => MediaStream }).captureStream(30)
    let audioTracks: MediaStreamTrack[] = []
    try {
      const srcStream = (video as unknown as { captureStream?: () => MediaStream }).captureStream?.()
      audioTracks = srcStream ? srcStream.getAudioTracks() : []
    }
    catch { /* clip has no audio / capture unsupported */ }
    const combined = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks])

    const recorder = new MediaRecorder(combined, { mimeType: mime })
    const chunks: BlobPart[] = []
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    const recorded = new Promise<Blob>((resolve) => { recorder.onstop = () => resolve(new Blob(chunks, { type: mime })) })

    recorder.start()
    await video.play()
    const draw = (): void => {
      ctx.drawImage(video, 0, 0, w, h)
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(0, h - barH, w, barH)
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.font = `600 ${fontPx}px system-ui, sans-serif`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.fillText(caption, w / 2, h - barH / 2)
      if (!video.ended)
        requestAnimationFrame(draw)
    }
    requestAnimationFrame(draw)
    await new Promise<void>((resolve) => { video.onended = () => resolve() })
    recorder.stop()
    const blob = await recorded
    return { blob, ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm' }
  }
  catch {
    return null
  }
}

/**
 * Share a saved asset via the native share sheet (with an OtherMe attribution
 * link), falling back to the WebView browser-link overlay / anchor download.
 * With `footer: true` the attribution is burned onto the pixels — directly for
 * images, and re-encoded onto every frame for videos (falls back to the
 * original clip + link text if the platform can't re-encode).
 */
export async function shareDataUrl(dataUrl: string, filename: string, opts?: { footer?: boolean }): Promise<void> {
  const isVideo = dataUrl.startsWith('data:video')
  if (opts?.footer && isVideo) {
    const burned = await burnVideoFooter(dataUrl, SHARE_CAPTION)
    if (burned) {
      const vname = filename.replace(/\.\w+$/, `.${burned.ext}`)
      await shareOrDownloadBlob(burned.blob, vname, { text: SHARE_CAPTION, url: SHARE_URL })
      return
    }
    // fall through: share the original clip + link text
  }
  const source = (opts?.footer && !isVideo) ? await burnFooter(dataUrl, SHARE_CAPTION) : dataUrl
  const blob = await (await fetch(source)).blob()
  await shareOrDownloadBlob(blob, filename, { text: SHARE_CAPTION, url: SHARE_URL })
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  void fetch(dataUrl)
    .then(response => response.blob())
    .then(blob => shareOrDownloadBlob(blob, filename))
}

export function downloadJson(value: unknown, filename: string): void {
  void shareOrDownloadBlob(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), filename)
}
