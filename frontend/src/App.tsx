import type { MouseEvent } from 'react'
import { Route, Routes } from 'react-router-dom'
import { DashboardPage } from './pages/DashboardPage'
import { DeviceDetailPage } from './pages/DeviceDetailPage'

function App() {
  const preventContextMenu = (e: MouseEvent) => e.preventDefault()

  return (
    <div className="h-screen w-screen bg-gray-950" onContextMenu={preventContextMenu}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/device/:id" element={<DeviceDetailPage />} />
      </Routes>
    </div>
  )
}

export default App
