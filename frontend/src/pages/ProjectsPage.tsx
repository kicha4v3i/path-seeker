import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { api, docId, formatEnvironment, type Project } from '@/lib/api'
import { Card } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { WorldProjectMap } from '@/components/WorldProjectMap'
import { ProjectFormDrawer } from '@/components/ProjectFormDrawer'

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerCountry, setDrawerCountry] = useState('')

  const loadProjects = useCallback(() => {
    setLoading(true)
    api.get<Project[]>('/projects').then(setProjects).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const openNewProject = (country = '') => {
    setDrawerCountry(country)
    setDrawerOpen(true)
  }

  return (
    <div className="relative h-full min-h-0 w-full">
      <WorldProjectMap projects={projects} onNewProject={openNewProject} />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-4 p-5">
        <div className="pointer-events-auto rounded-xl border border-border/60 bg-card/90 px-4 py-3 shadow-sm backdrop-blur-md">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">Hover a country for its name · click to create</p>
        </div>
        <div className="pointer-events-auto">
          <Button onClick={() => openNewProject()} className="shadow-sm">
            <Plus className="size-4" />
            New Project
          </Button>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 p-5">
        {loading ? (
          <p className="pointer-events-auto inline-block rounded-lg border border-border/60 bg-card/90 px-3 py-2 text-sm text-muted-foreground shadow-sm backdrop-blur-md">
            Loading projects...
          </p>
        ) : projects.length > 0 ? (
          <div className="pointer-events-auto max-w-full overflow-x-auto rounded-xl border border-border/60 bg-card/90 p-3 shadow-sm backdrop-blur-md">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Your Projects</p>
            <div className="flex gap-3">
              {projects.map((p) => (
                <Link
                  key={docId(p)}
                  to={`/projects/${docId(p)}`}
                  className="min-w-[180px] shrink-0 rounded-lg border border-border/80 bg-background/80 p-3 transition-colors hover:border-primary/50 hover:bg-accent/40"
                >
                  <h3 className="font-medium text-foreground">{p.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.location_country} · {formatEnvironment(p.environment)}
                    {p.unit_system ? ` · ${p.unit_system}` : ''}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <Card className="pointer-events-auto inline-block max-w-md">
            <p className="text-sm text-muted-foreground">No projects yet. Click a country to get started.</p>
          </Card>
        )}
      </div>

      <ProjectFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        initialCountry={drawerCountry}
        onCreated={loadProjects}
      />
    </div>
  )
}
