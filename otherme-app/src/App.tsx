import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Credits from './pages/Credits'
import CharacterStudio from './pages/CharacterStudio'
import RoleplayStudio from './pages/RoleplayStudio'
import Scenes from './pages/Scenes'
import Videos from './pages/Videos'
import Gallery from './pages/Gallery'

/** Every navigation lands on the top of the new page (hero / stage in view). */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/credits" element={<Credits />} />
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
