import { useRef, useState } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import type { ResponsiveLayouts } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { usePolling } from '@/hooks/usePolling'
import { getRoomReadings } from '@/modules/roomMap/api/roomMap'
import { Button } from '@/ui/Button'
import { IconCheck, IconPencil, IconRefreshCcw } from '@/ui/icons'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import { RoomOverviewCard } from '../components/RoomOverviewCard'
import { clearRoomLayout, loadRoomLayout, saveRoomLayout } from '../lib/roomLayoutStorage'

const REFRESH_INTERVAL_MS = 15_000
const GRID_BREAKPOINTS = { lg: 1024, md: 768, sm: 640 }
// Cols/row-height are 2x the visual default card size so cards can shrink below
// default (down to 1 unit) as well as grow, instead of the default already sitting
// at the grid's minimum resizable unit.
const GRID_COLS = { lg: 10, md: 8, sm: 6 }
const GRID_ROW_HEIGHT = 80
const DEFAULT_CARD_COLS = 5
const DEFAULT_CARD_UNITS = 2

const ResponsiveGridLayout = WidthProvider(Responsive)

export function RoomOverviewPage() {
  const { data: readings, error, loading } = usePolling(getRoomReadings, REFRESH_INTERVAL_MS)
  const [editing, setEditing] = useState(false)
  const [layouts, setLayouts] = useState<ResponsiveLayouts | null>(() => loadRoomLayout())
  // react-grid-layout normalizes its `layouts` prop internally (filling in gaps, adding
  // moved/static flags) and reports that back via onLayoutChange even when the change
  // wasn't user-driven — including right after we clear the saved layout on reset. Without
  // this guard that self-triggered call immediately re-persists a freshly computed layout,
  // undoing the reset.
  const suppressNextSaveRef = useRef(false)

  const handleLayoutChange = (_current: unknown, allLayouts: ResponsiveLayouts) => {
    setLayouts(allLayouts)
    // Outside edit mode the grid is not draggable/resizable, but react-grid-layout still
    // fires onLayoutChange once on mount while normalizing the `layouts` prop — don't
    // persist that, only user-driven changes made while editing.
    if (!editing || suppressNextSaveRef.current) {
      suppressNextSaveRef.current = false
      return
    }
    saveRoomLayout(allLayouts)
  }

  const handleReset = () => {
    clearRoomLayout()
    suppressNextSaveRef.current = true
    setLayouts(null)
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
      <PageHeader
        title="Home"
        actions={
          // The toggle only appears at sm+ (matches the rail/bottom-bar breakpoint), so edit mode
          // is never entered on a phone. If a desktop window is later narrowed mid-session the
          // grid keeps rendering — an accepted, rare edge case, not worth a JS media-query for.
          <div className="hidden items-center gap-2 sm:flex">
            {editing && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <IconRefreshCcw className="size-4" />
                Resetovat rozložení
              </Button>
            )}
            <Button variant="neutral" size="sm" onClick={() => setEditing((v) => !v)}>
              {editing ? <IconCheck className="size-4" /> : <IconPencil className="size-4" />}
              {editing ? 'Hotovo' : 'Upravit rozložení'}
            </Button>
          </div>
        }
      />
      {loading && !readings && <Loading label="Waking Nexus…" />}
      {error && <p className="text-danger">Failed to load room data: {error.message}</p>}
      {readings && !editing && !layouts && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {readings.map((reading) => (
            <RoomOverviewCard key={reading.room.id} reading={reading} />
          ))}
        </div>
      )}
      {readings && (editing || layouts) && (
        <ResponsiveGridLayout
          className="layout"
          breakpoints={GRID_BREAKPOINTS}
          cols={GRID_COLS}
          rowHeight={GRID_ROW_HEIGHT}
          layouts={layouts ?? undefined}
          isDraggable={editing}
          isResizable={editing}
          onLayoutChange={handleLayoutChange}
        >
          {readings.map((reading, index) => (
            <div
              key={reading.room.id}
              data-grid={
                layouts
                  ? undefined
                  : {
                      x: (index % DEFAULT_CARD_COLS) * DEFAULT_CARD_UNITS,
                      y: Math.floor(index / DEFAULT_CARD_COLS) * DEFAULT_CARD_UNITS,
                      w: DEFAULT_CARD_UNITS,
                      h: DEFAULT_CARD_UNITS,
                    }
              }
            >
              <RoomOverviewCard reading={reading} linkable={!editing} />
            </div>
          ))}
        </ResponsiveGridLayout>
      )}
    </div>
  )
}
