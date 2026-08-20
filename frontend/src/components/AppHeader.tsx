import { PanelLeft, PanelLeftClose } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppHeaderContext } from '@/components/AppHeaderContext'

type Props = {
  collapsed: boolean
  onToggle: () => void
}

export function AppHeader({ collapsed, onToggle }: Props) {
  const { header } = useAppHeaderContext()

  return (
    <header className="flex h-[var(--app-header-height)] shrink-0 items-center gap-3 border-b border-border/80 bg-card px-4 md:px-6">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
      </Button>
      {(header.title || header.subtitle) && (
        <div className="min-w-0 flex-1">
          {header.title && (
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground">
              {header.title}
            </h1>
          )}
          {header.subtitle && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{header.subtitle}</p>
          )}
        </div>
      )}
    </header>
  )
}
