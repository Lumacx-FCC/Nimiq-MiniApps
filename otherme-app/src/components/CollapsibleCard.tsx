/**
 * Collapsible om-card — header stays visible, body mounts only when open.
 * Keeps the studio scannable on a phone: every step is one header tall until
 * you (or the flow) opens it. Body values must live in page state, not the DOM.
 */
import { ChevronDown } from 'lucide-react'
import { ReactNode } from 'react'

interface Props {
  title: string
  open: boolean
  onToggle: () => void
  icon?: ReactNode
  /** Rendered beside the toggle, outside it — stays independently clickable. */
  right?: ReactNode
  /** Extra classes on the card itself (e.g. `h-fit` for grid columns). */
  className?: string
  children: ReactNode
}

export default function CollapsibleCard({ title, open, onToggle, icon, right, className, children }: Props) {
  return (
    <section className={`om-card${className ? ` ${className}` : ''}`}>
      <div className={`flex items-center justify-between gap-2 ${open ? 'mb-3' : ''}`}>
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 min-w-0 bg-transparent border-none p-0 cursor-pointer text-left text-sm font-extrabold uppercase tracking-widest"
          style={{ color: 'var(--text-40)' }}
        >
          {icon}
          <span className="truncate">{title}</span>
          <ChevronDown
            size={16}
            className="shrink-0"
            style={{
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.25s var(--nimiq-ease)',
            }}
          />
        </button>
        {right}
      </div>
      {open && children}
    </section>
  )
}
