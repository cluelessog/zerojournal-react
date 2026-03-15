import { useState, useEffect, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useUIStore } from '@/lib/store/ui-store'
import { usePortfolioStore } from '@/lib/store/portfolio-store'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'

interface NavItem {
  path: string
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: '◉' },
  { path: '/trades', label: 'Trades', icon: '⇄' },
  { path: '/analysis', label: 'Analysis', icon: '◈' },
  { path: '/journal', label: 'Journal', icon: '📓' },
  { path: '/import', label: 'Import', icon: '↑' },
]

interface AppShellProps {
  children: ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore()
  const isLoaded = usePortfolioStore((s) => s.isLoaded)
  const importMetadata = usePortfolioStore((s) => s.importMetadata)
  const clearData = usePortfolioStore((s) => s.clearData)
  const location = useLocation()
  const navigate = useNavigate()
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  // Auto-collapse sidebar on screens narrower than 1280px
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1279px)')
    function handleChange(e: MediaQueryListEvent | MediaQueryList) {
      if (e.matches) {
        setSidebarOpen(false)
      }
    }
    handleChange(mq)
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [setSidebarOpen])

  // Auto-close mobile drawer when viewport crosses 768px
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    function handleChange(e: MediaQueryListEvent | MediaQueryList) {
      if (e.matches) {
        setMobileDrawerOpen(false)
      }
    }
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [])

  async function handleReset() {
    setResetting(true)
    await clearData()
    setResetting(false)
    setResetDialogOpen(false)
    navigate('/import')
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Sidebar — hidden on mobile, visible on md+ */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-200 shrink-0',
          sidebarOpen ? 'w-56' : 'w-14',
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center h-14 px-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
          {sidebarOpen && (
            <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-gray-100 truncate mr-auto">
              zeroJournal
            </span>
          )}
          <button
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
          >
            {sidebarOpen ? '←' : '→'}
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/' || (isLoaded && location.pathname === '/')
                : location.pathname.startsWith(item.path)

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-2 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100',
                )}
                title={!sidebarOpen ? item.label : undefined}
              >
                <span className="text-base shrink-0">{item.icon}</span>
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* Sidebar footer - data status + reset */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800 shrink-0 space-y-2">
          {sidebarOpen && (
            <div
              className={cn(
                'text-xs px-2 py-1.5 rounded-md',
                isLoaded
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-500',
              )}
            >
              {isLoaded
                ? `${importMetadata?.tradebookRowCount ?? 0} trades loaded`
                : 'No data imported'}
            </div>
          )}
          {isLoaded && (
            <button
              onClick={() => setResetDialogOpen(true)}
              title={!sidebarOpen ? 'Reset Data' : undefined}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
                !sidebarOpen && 'justify-center',
              )}
            >
              <span className="shrink-0">✕</span>
              {sidebarOpen && <span>Reset Data</span>}
            </button>
          )}
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex items-center h-14 px-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
          {/* Hamburger button — mobile only */}
          <button
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open navigation"
            className="md:hidden p-2 mr-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
          >
            <Menu className="size-5" />
          </button>
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {NAV_ITEMS.find(
              (n) =>
                n.path === location.pathname ||
                (n.path !== '/' && location.pathname.startsWith(n.path)),
            )?.label ?? 'zeroJournal'}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full',
                isLoaded
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500',
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isLoaded ? 'bg-green-500' : 'bg-gray-400',
                )}
              />
              {isLoaded ? 'Data loaded' : 'No data'}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>

        {/* Footer */}
        <footer className="h-8 px-4 flex items-center border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
          <span className="text-xs text-gray-400">
            zeroJournal — client-side only, your data never leaves this browser
          </span>
        </footer>
      </div>

      {/* Mobile drawer overlay */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <aside className="absolute left-0 top-0 h-full w-64 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shadow-xl">
            {/* Drawer header */}
            <div className="flex items-center h-14 px-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
              <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-gray-100 truncate mr-auto">
                zeroJournal
              </span>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close navigation"
                className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="size-5" />
              </button>
            </div>
            {/* Nav links */}
            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.path)
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100',
                    )}
                  >
                    <span className="text-base shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                )
              })}
            </nav>
            {/* Drawer footer */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-800 shrink-0 space-y-2">
              <div
                className={cn(
                  'text-xs px-2 py-1.5 rounded-md',
                  isLoaded
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-500',
                )}
              >
                {isLoaded
                  ? `${importMetadata?.tradebookRowCount ?? 0} trades loaded`
                  : 'No data imported'}
              </div>
              {isLoaded && (
                <button
                  onClick={() => {
                    setMobileDrawerOpen(false)
                    setResetDialogOpen(true)
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <span className="shrink-0">✕</span>
                  <span>Reset Data</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Reset confirmation dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset all data?</DialogTitle>
            <DialogDescription>
              This will delete all imported data. You'll need to re-upload your files. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)} disabled={resetting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReset} disabled={resetting}>
              {resetting ? 'Resetting…' : 'Reset Data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
