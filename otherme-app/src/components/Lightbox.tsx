/**
 * Full-screen image viewer: tap the image to toggle zoom, tap the backdrop
 * (or the X) to close. Native pinch-zoom stays available inside the overlay.
 */
import { X } from 'lucide-react'
import { useState } from 'react'

export default function Lightbox({ src, alt, kind = 'image', onClose }: { src: string, alt: string, kind?: 'image' | 'video', onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false)
  return (
    <div
      className="fixed inset-0 z-[90] overflow-auto"
      style={{ background: 'rgba(2,6,12,.93)', touchAction: 'pan-x pan-y pinch-zoom' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        className="fixed top-4 right-4 z-[91] w-10 h-10 rounded-full flex items-center justify-center text-white"
        style={{ background: 'rgba(255,255,255,.14)' }}
        onClick={onClose}
        aria-label="Close"
      >
        <X size={20} />
      </button>
      <div className="min-h-full w-full flex items-center justify-center p-4">
        {kind === 'video'
          ? (
              <video
                src={src}
                controls
                autoPlay
                playsInline
                className="max-w-full max-h-[92vh] rounded-xl"
                onClick={event => event.stopPropagation()}
              />
            )
          : (
              <img
                src={src}
                alt={alt}
                className={zoomed ? 'cursor-zoom-out max-w-none w-[190%] sm:w-[150%] h-auto' : 'cursor-zoom-in max-w-full max-h-[92vh] object-contain'}
                onClick={(event) => { event.stopPropagation(); setZoomed(!zoomed) }}
              />
            )}
      </div>
    </div>
  )
}
