/**
 * Web Speech recognizer — shared with RoleplayStudio's dictation fallback.
 * Confirmed on-device 2026-07-28 (Samsung Fold 5 / Android 16, WebView Chrome
 * 150): `getUserMedia` fails inside Nimiq Pay with `NotReadableError`, but
 * `SpeechRecognition` works because Android's system speech service captures
 * audio in its own process rather than through the WebView.
 *
 * Typed only as far as we use it; the DOM lib ships no stable definitions.
 */
export interface SpeechAlternative { transcript: string }
export interface SpeechResult { readonly length: number, [index: number]: SpeechAlternative }
export interface SpeechResultList { readonly length: number, [index: number]: SpeechResult }
export interface SpeechResultEvent { resultIndex: number, results: SpeechResultList }
export interface SpeechErrorEvent { error: string }
export interface SpeechRecognizer {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: ((event: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

export function getSpeechRecognizer(): (new () => SpeechRecognizer) | null {
  const scope = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognizer
    webkitSpeechRecognition?: new () => SpeechRecognizer
  }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null
}
