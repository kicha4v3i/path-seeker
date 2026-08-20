import { Link, useParams } from 'react-router-dom'
import { cn } from '@/lib/utils'

const steps = [
  { key: 'subsurface', label: 'Subsurface', path: 'subsurface' },
  { key: 'trajectory', label: 'Trajectory', path: 'trajectory' },
  { key: 'report', label: 'Report', path: 'report' },
]

export function WellWizardNav({ active }: { active: string }) {
  const { projectId, wellId } = useParams()
  const base = `/projects/${projectId}/wells/${wellId}`

  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-4">
      {steps.map((s, i) => (
        <Link
          key={s.key}
          to={`${base}/${s.path}`}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium',
            active === s.path ? 'bg-primary text-white' : 'bg-background text-text hover:opacity-80',
          )}
        >
          {i + 1}. {s.label}
        </Link>
      ))}
    </div>
  )
}
