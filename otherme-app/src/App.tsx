import { Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Credits from './pages/Credits'
import CharacterStudio from './pages/CharacterStudio'
import RoleplayStudio from './pages/RoleplayStudio'
import Scenes from './pages/Scenes'
import Videos from './pages/Videos'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/credits" element={<Credits />} />
      <Route path="/create" element={<CharacterStudio />} />
      <Route path="/talk" element={<RoleplayStudio />} />
      <Route path="/scenes" element={<Scenes />} />
      <Route path="/videos" element={<Videos />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  )
}
