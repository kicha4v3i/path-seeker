import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { FolderKanban, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AppHeader } from '@/components/AppHeader'
import { AppHeaderProvider } from '@/components/AppHeaderContext'

const nav = [
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const STORAGE_KEY = 'pathseeker.sidebar.collapsed'

export function AppLayout() {
  const location = useLocation()
  const isProjectsMap = location.pathname === '/projects' || location.pathname === '/'
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      // ignore storage failures
    }
  }, [collapsed])

  return (
    <AppHeaderProvider>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <aside
          className={cn(
            'z-40 flex shrink-0 flex-col border-r border-border/80 bg-card transition-[width] duration-200 ease-out',
            collapsed ? 'w-[4.25rem]' : 'w-60',
          )}
        >
          <div
            className={cn(
              'flex shrink-0 items-center border-b border-border/80',
              collapsed
                ? 'h-[var(--app-header-height)] justify-center px-2'
                : 'h-[var(--app-header-height)] px-4',
            )}
          >
            {collapsed ? (
              <span className="text-sm font-semibold tracking-tight text-primary" title="Path Seeker">
                PS
              </span>
            ) : (
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold tracking-tight text-primary">Path Seeker</h1>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">Well trajectory planning</p>
              </div>
            )}
          </div>

          <nav className={cn('flex flex-1 flex-col gap-1 p-2', collapsed && 'items-center')}>
            {nav.map(({ to, label, icon: Icon }) => {
              const active = location.pathname.startsWith(to)
              return (
                <Link
                  key={to}
                  to={to}
                  title={label}
                  className={cn(
                    'flex items-center rounded-md text-sm font-medium transition-colors',
                    collapsed ? 'size-10 justify-center' : 'gap-2.5 px-3 py-2',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0 opacity-90" />
                  {collapsed ? <span className="sr-only">{label}</span> : <span>{label}</span>}
                </Link>
              )
            })}
          </nav>
        </aside>

        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <AppHeader collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
          <div
            className={cn(
              'min-h-0 flex-1',
              isProjectsMap ? 'overflow-hidden' : 'overflow-auto p-6 md:p-8',
            )}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </AppHeaderProvider>
  )
}
