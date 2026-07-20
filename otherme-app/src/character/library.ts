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
  const json = await response.json() as { url?: string, error?: string }
  if (!response.ok || !json.url)
    throw new Error(json.error || 'Could not create download link')
  // Prod (Cloud Function) returns an absolute Firebase Storage URL; the dev
  // Vite middleware returns a relative /api/share/:id path.
  const link = json.url.startsWith('http') ? json.url : `${window.location.origin}${json.url}`
  showBrowserLinkOverlay(link, filename)
}

function showBrowserLinkOverlay(url: string, filename: string): void {
  const es = localStorage.getItem('otherme:lang') === 'es'
  const copy = {
    title: es ? 'Descargar en tu navegador' : 'Download in your browser',
    body: es
      ? `Nimiq Pay aún no permite guardar archivos directamente. Copia este enlace y ábrelo en el navegador de tu teléfono (Chrome) para descargar «${filename}». El enlace expira en 30 minutos.`
      : `Nimiq Pay can't save files directly yet. Copy this link and open it in your phone's browser (Chrome) to download “${filename}”. The link expires in 30 minutes.`,
    copyLabel: es ? 'Copiar enlace' : 'Copy link',
    copied: es ? '¡Copiado!' : 'Copied!',
    close: es ? 'Cerrar' : 'Close',
  }

  const overlay = document.createElement('div')
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.style.cssText = 'position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:20px;background:rgba(2,6,12,.85)'
  const card = document.createElement('div')
  card.style.cssText = 'max-width:420px;width:100%;border-radius:16px;padding:20px;background:var(--nq-card,#1f2348);color:var(--text-100,#fff);box-shadow:0 24px 70px rgba(0,0,0,.5);font-family:inherit'
  card.innerHTML = `
    <h3 style="margin:0 0 8px;font-size:16px;font-weight:800">${copy.title}</h3>
    <p style="margin:0 0 12px;font-size:13px;line-height:1.5;opacity:.85"></p>
    <input readonly style="width:100%;box-sizing:border-box;border:none;outline:none;border-radius:10px;padding:10px;font-size:12px;background:var(--highlight-bg,rgba(255,255,255,.08));color:inherit" />
    <div style="display:flex;gap:8px;margin-top:14px">
      <button data-action="copy" style="flex:1;border:none;border-radius:999px;padding:11px;font-weight:700;font-size:13px;cursor:pointer;background:var(--om-cta-bg,#2ea3b4);color:#fff"></button>
      <button data-action="close" style="border:none;border-radius:999px;padding:11px 18px;font-weight:700;font-size:13px;cursor:pointer;background:var(--highlight-bg,rgba(255,255,255,.1));color:inherit"></button>
    </div>`
  card.querySelector('p')!.textContent = copy.body
  const input = card.querySelector('input')!
  input.value = url
  const copyButton = card.querySelector<HTMLButtonElement>('[data-action="copy"]')!
  copyButton.textContent = copy.copyLabel
  card.querySelector<HTMLButtonElement>('[data-action="close"]')!.textContent = copy.close

  const closeOverlay = () => overlay.remove()
  overlay.addEventListener('click', event => event.target === overlay && closeOverlay())
  card.querySelector('[data-action="close"]')!.addEventListener('click', closeOverlay)
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url)
    }
    catch {
      input.select()
      document.execCommand('copy')
    }
    copyButton.textContent = copy.copied
    window.setTimeout(() => { copyButton.textContent = copy.copyLabel }, 2000)
  })
  input.addEventListener('click', () => input.select())
  overlay.appendChild(card)
  document.body.appendChild(overlay)
}

async function shareOrDownloadBlob(blob: Blob, filename: string): Promise<void> {
  // Preferred: the native share sheet (real mobile browsers).
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return
    }
    catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError')
        return // user closed the share sheet
      // Share unavailable after all — fall through.
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

export function downloadDataUrl(dataUrl: string, filename: string): void {
  void fetch(dataUrl)
    .then(response => response.blob())
    .then(blob => shareOrDownloadBlob(blob, filename))
}

export function downloadJson(value: unknown, filename: string): void {
  void shareOrDownloadBlob(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), filename)
}
