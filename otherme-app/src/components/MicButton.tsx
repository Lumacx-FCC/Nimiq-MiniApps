/**
 * Voice-to-text button for a text field — dictates via the same Web Speech
 * recognizer RoleplayStudio uses for its in-wallet voice fallback (see
 * src/core/speech.ts). Renders nothing when the browser has no
 * SpeechRecognition (desktop Firefox, older WebViews).
 */
import { Mic, MicOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Lang } from '../app/providers'
import { getSpeechRecognizer, SpeechRecognizer } from '../core/speech'

export default function MicButton({ lang, onStart, onResult, className }: {
  lang: Lang
  /** Called once, right when the mic turns on — clear this field's own value here. */
  onStart?: () => void
  /** Called with each finalized phrase — append it to the field's value. */
  onResult: (text: string) => void
  className?: string
}) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognizer | null>(null)
  const supported = useRef(!!getSpeechRecognizer()).current

  useEffect(() => () => recognitionRef.current?.abort(), [])

  if (!supported)
    return null

  const stop = () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }

  const start = () => {
    const Recognizer = getSpeechRecognizer()
    if (!Recognizer)
      return
    onStart?.()
    const recognition = new Recognizer()
    recognition.lang = lang === 'es' ? 'es-ES' : 'en-US'
    recognition.continuous = true
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++)
        transcript += `${event.results[i][0].transcript} `
      transcript = transcript.trim()
      if (transcript)
        onResult(transcript)
    }
    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted')
        return
      stop()
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  return (
    <button
      type="button"
      className={className ?? 'icon-chip !min-w-0 !px-2'}
      style={listening ? { background: 'var(--nimiq-red)', color: '#fff' } : undefined}
      onClick={() => (listening ? stop() : start())}
      aria-pressed={listening}
      title={lang === 'es' ? 'Dictar por voz' : 'Voice dictation'}
    >
      {listening ? <MicOff size={14} /> : <Mic size={14} />}
    </button>
  )
}
