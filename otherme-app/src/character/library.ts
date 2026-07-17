/**
 * Saved character sheets — localStorage for the hackathon.
 * Post-hackathon migration seam: swap these four functions for Firebase
 * (Firestore doc per sheet, Storage for the image) without touching the UI.
 */
import type { CharacterSheet } from './fields'

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

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = filename
  anchor.click()
}

export function downloadJson(value: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  downloadDataUrl(url, filename)
  URL.revokeObjectURL(url)
}
