import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Guard from './auth/Guard'
import Login from './pages/Login'
import Tools from './pages/Tools'
import ToolSettings from './pages/ToolSettings'
import Agent from './pages/Agent'
import Logs from './pages/Logs'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/tools" element={<Guard><Tools /></Guard>} />
        <Route path="/tools/:id" element={<Guard><ToolSettings /></Guard>} />
        <Route path="/agent" element={<Guard><Agent /></Guard>} />
        <Route path="/logs" element={<Guard><Logs /></Guard>} />
        <Route path="*" element={<Navigate to="/tools" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
