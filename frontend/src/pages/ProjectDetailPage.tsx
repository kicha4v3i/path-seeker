import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Droplets, Plus } from 'lucide-react'
import { api, docId, formatEnvironment, type Project, type Well } from '@/lib/api'
import { lengthUnit } from '@/lib/utils'
import { Card } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { WellFormDrawer } from '@/components/WellFormDrawer'
import { getWellColumns } from '@/components/wells/wells-columns'

export function ProjectDetailPage() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [project, setProject] = useState<Project | null>(null)
  const [wells, setWells] = useState<Well[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [wellDrawerOpen, setWellDrawerOpen] = useState(false)
  const [editingWell, setEditingWell] = useState<Well | null>(null)
  const [deletingId, setDeletingId] = useState('')

  const load = () => {
    if (!projectId || projectId === 'undefined') {
      setError('Invalid project id')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    Promise.all([
      api.get<Project>(`/projects/${projectId}`),
      api.get<Well[]>(`/projects/${projectId}/wells`),
    ])
      .then(([p, w]) => {
        setProject(p)
        setWells(w)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load project')
        setProject(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [projectId])

  useEffect(() => {
    if (searchParams.get('newWell') === '1') {
      setEditingWell(null)
      setWellDrawerOpen(true)
    }
  }, [searchParams])

  const openNewWellDrawer = () => {
    setEditingWell(null)
    setWellDrawerOpen(true)
  }

  const onWellDrawerChange = (open: boolean) => {
    setWellDrawerOpen(open)
    if (!open) {
      setEditingWell(null)
      if (searchParams.get('newWell')) {
        const next = new URLSearchParams(searchParams)
        next.delete('newWell')
        setSearchParams(next, { replace: true })
      }
    }
  }

  const handleEdit = (well: Well) => {
    setEditingWell(well)
    setWellDrawerOpen(true)
  }

  const handleRowClick = (well: Well) => {
    const id = docId(well)
    if (!projectId || !id) return
    navigate(`/projects/${projectId}/wells/${id}/trajectory`)
  }

  const handleDelete = async (well: Well) => {
    const id = docId(well)
    if (!id || deletingId) return
    if (!window.confirm(`Delete well “${well.name}”? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      await api.delete(`/wells/${id}`)
      load()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete well')
    } finally {
      setDeletingId('')
    }
  }

  const rkbUnit = lengthUnit(project?.unit_system || 'API')
  const columns = useMemo(
    () =>
      getWellColumns(rkbUnit, {
        onEdit: handleEdit,
        onDelete: handleDelete,
      }),
    // recreate when delete lock changes so buttons stay consistent
    [rkbUnit, deletingId],
  )

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading project...</p>
  }

  if (error || !project || !projectId) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error || 'Project not found'}</p>
        <Link to="/projects" className="text-sm text-primary underline-offset-4 hover:underline">
          Back to projects
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{project.name}</h1>
          <p className="text-sm text-muted-foreground">
            {project.location_country} · {formatEnvironment(project.environment)}
            {project.unit_system ? ` · ${project.unit_system}` : ''}
            {project.field ? ` · ${project.field}` : ''}
          </p>
        </div>
        <Link to={`/projects/${projectId}/edit`}>
          <Button variant="outline">Edit Project</Button>
        </Link>
      </div>

      <Card title="Wells">
        {wells.length === 0 ? (
          <Empty className="border-border/70">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Droplets />
              </EmptyMedia>
              <EmptyTitle>No wells yet</EmptyTitle>
              <EmptyDescription>
                Create a well to enter surface coordinates, subsurface data, and generate a trajectory.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={openNewWellDrawer}>
                <Plus className="size-4" />
                New Well
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <div className="mb-4 flex justify-end">
              <Button onClick={openNewWellDrawer}>
                <Plus className="size-4" />
                New Well
              </Button>
            </div>
            <DataTable columns={columns} data={wells} onRowClick={handleRowClick} />
          </>
        )}
      </Card>

      <WellFormDrawer
        open={wellDrawerOpen}
        onOpenChange={onWellDrawerChange}
        projectId={projectId}
        project={project}
        well={editingWell}
        onSaved={load}
      />
    </div>
  )
}
