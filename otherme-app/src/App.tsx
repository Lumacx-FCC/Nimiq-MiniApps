import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Credits from './pages/Credits'
import Profile from './pages/Profile'
import CharacterStudio from './pages/CharacterStudio'
import RoleplayStudio from './pages/RoleplayStudio'
import Scenes from './pages/Scenes'
import Videos from './pages/Videos'
import Gallery from './pages/Gallery'
import { reconcileSheetsWithCloud } from './character/library'
import { reconcileAvatarsWithCloud } from './roleplay/avatarLibrary'
import { onSessionChange } from './core/session'

/** Every navigation lands on the top of the new page (hero / stage in view). */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [pathname])
  return null
}

/** Part C: whenever a real server session appears (login, restored session on
 * reload, or an account-link commit), push local-only media up and pull the
 * rest of the cloud set down. No-op while logged out. */
function useCloudMediaSync() {
  useEffect(() => onSessionChange((uid) => {
    if (!uid)
      return
    reconcileSheetsWithCloud(uid).catch(() => {})
    reconcileAvatarsWithCloud(uid).catch(() => {})
  }), [])
}

export default function App() {
  useCloudMediaSync()
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/credits" element={<Credits />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/create" element={<CharacterStudio />} />
        <Route path="/talk" element={<RoleplayStudio />} />
        <Route path="/scenes" element={<Scenes />} />
        <Route path="/videos" element={<Videos />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </>
  )
}
