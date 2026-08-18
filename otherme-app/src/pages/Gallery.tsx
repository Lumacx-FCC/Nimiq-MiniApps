/**
 * Unified gallery — one place to browse everything you've made, in three tabs
 * (Characters / Scenes / Videos), each a responsive grid of larger thumbnails.
 * Tap to zoom (images and videos via the shared Lightbox), and act on any asset
 * with the same cross-navigation handoffs the rest of the app uses:
 *   character → Scene / Video / Talk   ·   scene → Video / Talk   ·   video → Play
 * Sources: characters from localStorage (listSheets), scenes/videos from
 * IndexedDB (listMedia). Non-destructive — the per-page inline galleries stay.
 */
import { ImagePlus, MessageCircle, Plus, Share2, Sparkles, Trash2, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../app/providers'
import { useAuth } from '../core/auth'
import { deleteSheet, listSheets, SavedSheet, shareDataUrl } from '../character/library'
import { deleteMedia, listMedia, SavedScene, SavedVideo } from '../core/mediaStore'
import AppHeader from '../components/AppHeader'
import Lightbox from '../components/Lightbox'

type Tab = 'characters' | 'scenes' | 'videos'

const COPY = {
  en: {
    title: 'Your gallery',
    characters: 'Characters',
    scenes: 'Scenes',
    videos: 'Videos',
    create: 'Create more',
    empty: 'Nothing here yet.',
    scene: 'Scene',
    video: 'Video',
    talk: 'Talk',
    play: 'Play',
    share: 'Share',
    del: 'Delete',
    loginNeeded: 'Log in to see your gallery.',
    confirmDel: 'Delete this permanently?',
  },
  es: {
    title: 'Tu galería',
    characters: 'Personajes',
    scenes: 'Escenas',
    videos: 'Videos',
    create: 'Crear más',
    empty: 'Aún no hay nada aquí.',
    scene: 'Escena',
    video: 'Video',
    talk: 'Hablar',
    play: 'Reproducir',
    share: 'Compartir',
    del: 'Eliminar',
    loginNeeded: 'Inicia sesión para ver tu galería.',
    confirmDel: '¿Eliminar esto permanentemente?',
  },
} as const

const slug = (s: string) => s.replace(/\s+/g, '-')

export default function Gallery() {
  const { lang } = useSettings()
  const t = COPY[lang]
  const navigate = useNavigate()
  const { isLoggedIn } = useAuth()

  const [tab, setTab] = useState<Tab>('characters')
  const [characters, setCharacters] = useState<SavedSheet[]>([])
  const [scenes, setScenes] = useState<SavedScene[]>([])
  const [videos, setVideos] = useState<SavedVideo[]>([])
  const [lightbox, setLightbox] = useState<{ src: string, alt: string, kind: 'image' | 'video' } | null>(null)

  useEffect(() => {
    if (!isLoggedIn)
      navigate('/login', { state: { redirectTo: '/gallery' } })
  }, [isLoggedIn, navigate])

  const reload = () => {
    setCharacters(listSheets())
    void listMedia<SavedScene>('scenes').then(setScenes).catch(() => setScenes([]))
    void listMedia<SavedVideo>('videos').then(setVideos).catch(() => setVideos([]))
  }
  useEffect(reload, [])

  /* Cross-navigation handoffs — same transport as Landing/Scenes: heavy image
     data URLs via sessionStorage, lightweight ids/prompts via router state. */
  const talkWith = (imageDataUrl: string | null, name: string) => {
    if (!imageDataUrl)
      return
    sessionStorage.setItem('otherme:avatar-reference', JSON.stringify({ imageDataUrl, name }))
    navigate('/talk')
  }
  const sceneFromCharacter = (id: string) => navigate('/scenes', { state: { characterId: id } })
  const videoFromCharacter = (id: string) => navigate('/videos', { state: { characterId: id } })
  const videoFromScene = (scene: SavedScene) => {
    sessionStorage.setItem('otherme:video-reference', JSON.stringify({ imageDataUrl: scene.imageDataUrl, name: scene.name }))
    navigate('/videos', { state: { seedPrompt: scene.prompt } })
  }

  const createTarget: Record<Tab, string> = { characters: '/create', scenes: '/scenes', videos: '/videos' }

  const removeCharacter = (id: string) => { if (confirm(t.confirmDel)) { deleteSheet(id); reload() } }
  const removeScene = async (id: string) => { if (confirm(t.confirmDel)) { await deleteMedia('scenes', id); reload() } }
  const removeVideo = async (id: string) => { if (confirm(t.confirmDel)) { await deleteMedia('videos', id); reload() } }

  if (!isLoggedIn) {
    return (
      <div className="page-shell wide">
        <AppHeader />
        <div className="om-card text-center">{t.loginNeeded}</div>
      </div>
    )
  }

  const tabs: { key: Tab, label: string }[] = [
    { key: 'characters', label: `${t.characters} (${characters.length})` },
    { key: 'scenes', label: `${t.scenes} (${scenes.length})` },
    { key: 'videos', label: `${t.videos} (${videos.length})` },
  ]

  const activeCount = tab === 'characters' ? characters.length : tab === 'scenes' ? scenes.length : videos.length

  return (
    <div className="page-shell wide">
      <AppHeader />

      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} kind={lightbox.kind} onClose={() => setLightbox(null)} />}

      <div className="om-card mb-4">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="px-3 py-2 rounded-full text-sm font-bold transition-colors"
                style={{
                  background: tab === key ? 'var(--nimiq-light-blue)' : 'var(--highlight-bg)',
                  color: tab === key ? '#fff' : 'var(--text-60)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="om-button green !min-h-[40px] !text-sm" onClick={() => navigate(createTarget[tab])}>
            <Plus size={15} />{t.create}
          </button>
        </div>

        {!activeCount && <p className="text-sm text-center py-8" style={{ color: 'var(--text-40)' }}>{t.empty}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {tab === 'characters' && characters.map(c => (
            <figure key={c.id} className="rounded-xl overflow-hidden m-0" style={{ background: 'var(--highlight-bg)' }}>
              {c.imageDataUrl
                ? <img src={c.imageDataUrl} alt={c.name} className="w-full aspect-square object-cover cursor-zoom-in" onClick={() => setLightbox({ src: c.imageDataUrl!, alt: c.name, kind: 'image' })} />
                : <div className="w-full aspect-square flex items-center justify-center" style={{ color: 'var(--text-40)' }}><Sparkles size={28} /></div>}
              <figcaption className="p-2">
                <p className="text-[12px] font-bold truncate m-0">{c.name}</p>
                {c.data?.alias && <p className="text-[10px] m-0 truncate" style={{ color: 'var(--text-40)' }}>{c.data.alias}</p>}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <button className="icon-chip !min-h-[30px] !min-w-0 !px-2 !text-[11px]" onClick={() => sceneFromCharacter(c.id)}><ImagePlus size={12} />{t.scene}</button>
                  <button className="icon-chip !min-h-[30px] !min-w-0 !px-2 !text-[11px]" onClick={() => videoFromCharacter(c.id)}><Video size={12} />{t.video}</button>
                  <button className="icon-chip !min-h-[30px] !min-w-0 !px-2 !text-[11px]" onClick={() => talkWith(c.imageDataUrl, c.name)}><MessageCircle size={12} />{t.talk}</button>
                  {c.imageDataUrl && <button className="icon-chip !min-h-[30px] !min-w-0 !px-2" title={t.share} onClick={() => void shareDataUrl(c.imageDataUrl!, `${slug(c.name)}.webp`, { footer: true })}><Share2 size={12} /></button>}
                  <button className="icon-chip !min-h-[30px] !min-w-0 !px-2" title={t.del} onClick={() => removeCharacter(c.id)}><Trash2 size={12} style={{ color: 'var(--nimiq-red)' }} /></button>
                </div>
              </figcaption>
            </figure>
          ))}

          {tab === 'scenes' && scenes.map(s => (
            <figure key={s.id} className="rounded-xl overflow-hidden m-0" style={{ background: 'var(--highlight-bg)' }}>
              <img src={s.imageDataUrl} alt={s.name} className="w-full aspect-square object-cover cursor-zoom-in" onClick={() => setLightbox({ src: s.imageDataUrl, alt: s.name, kind: 'image' })} />
              <figcaption className="p-2">
                <p className="text-[12px] font-bold truncate m-0">{s.name}</p>
                {s.characterName && <p className="text-[10px] m-0 truncate" style={{ color: 'var(--text-40)' }}>{s.characterName}</p>}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <button className="icon-chip !min-h-[30px] !min-w-0 !px-2 !text-[11px]" onClick={() => videoFromScene(s)}><Video size={12} />{t.video}</button>
                  <button className="icon-chip !min-h-[30px] !min-w-0 !px-2 !text-[11px]" onClick={() => talkWith(s.imageDataUrl, s.characterName || s.name)}><MessageCircle size={12} />{t.talk}</button>
                  <button className="icon-chip !min-h-[30px] !min-w-0 !px-2" title={t.share} onClick={() => void shareDataUrl(s.imageDataUrl, `${slug(s.name)}.webp`, { footer: true })}><Share2 size={12} /></button>
                  <button className="icon-chip !min-h-[30px] !min-w-0 !px-2" title={t.del} onClick={() => void removeScene(s.id)}><Trash2 size={12} style={{ color: 'var(--nimiq-red)' }} /></button>
                </div>
              </figcaption>
            </figure>
          ))}

          {tab === 'videos' && videos.map(v => (
            <figure key={v.id} className="rounded-xl overflow-hidden m-0" style={{ background: 'var(--highlight-bg)' }}>
              <video src={v.videoDataUrl} className="w-full aspect-square object-cover cursor-pointer" onClick={() => setLightbox({ src: v.videoDataUrl, alt: v.name, kind: 'video' })} />
              <figcaption className="p-2">
                <p className="text-[12px] font-bold truncate m-0">{v.name}</p>
                {v.characterName && <p className="text-[10px] m-0 truncate" style={{ color: 'var(--text-40)' }}>{v.characterName}</p>}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <button className="icon-chip !min-h-[30px] !min-w-0 !px-2 !text-[11px]" onClick={() => setLightbox({ src: v.videoDataUrl, alt: v.name, kind: 'video' })}><Video size={12} />{t.play}</button>
                  <button className="icon-chip !min-h-[30px] !min-w-0 !px-2" title={t.share} onClick={() => void shareDataUrl(v.videoDataUrl, `${slug(v.name)}.mp4`, { footer: true })}><Share2 size={12} /></button>
                  <button className="icon-chip !min-h-[30px] !min-w-0 !px-2" title={t.del} onClick={() => void removeVideo(v.id)}><Trash2 size={12} style={{ color: 'var(--nimiq-red)' }} /></button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  )
}
