/**
 * Once a synced sheet/avatar/scene is pulled down from the cloud (Part C
 * reconcile), its image field holds a Storage download URL (https://...)
 * instead of the local data: URL it started as — both are valid <img src>
 * values, but anything that still needs base64 (AI-generation reference
 * payloads) must fetch + re-encode a remote URL first. `splitDataUrl` on an
 * https URL silently returns `base64: undefined` with no error.
 */
export async function ensureDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:'))
    return url
  const response = await fetch(url)
  const blob = await response.blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error || new Error('Could not read fetched reference image'))
    reader.readAsDataURL(blob)
  })
}
