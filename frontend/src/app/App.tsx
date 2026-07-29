import type { MouseEvent } from 'react'
import { useRoutes } from 'react-router-dom'
import { cookRoutes } from '@/modules/recipes/cook/routes'
import { AppShell } from './AppShell'
import { shellModules } from './modules'

function App() {
  const preventContextMenu = (e: MouseEvent) => e.preventDefault()

  const element = useRoutes([
    // Regular pages share the shell (rail navigation + content outlet).
    { element: <AppShell />, children: shellModules.flatMap((module) => module.routes) },
    // Kiosk routes render full-screen without the shell.
    ...cookRoutes,
  ])

  return (
    <div className="h-full w-full bg-surface text-ink" onContextMenu={preventContextMenu}>
      {element}
    </div>
  )
}

export default App
