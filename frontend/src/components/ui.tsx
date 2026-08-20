import { cn } from '@/lib/utils'

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label: string }

export function InputField({ label, className, ...props }: Props) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        className={cn(
          'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          className,
        )}
        {...props}
      />
    </label>
  )
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  options: string[]
}

export function SelectField({ label, options, className, ...props }: SelectProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        className={cn(
          'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          className,
        )}
        {...props}
      >
        <option value="">Select...</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}

export function UnitSystemToggle({
  value,
  onChange,
  label = 'Unit System',
}: {
  value: string
  onChange: (value: 'API' | 'SI') => void
  label?: string
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div
        role="group"
        aria-label={label}
        className="inline-flex rounded-md border border-input bg-transparent p-0.5 shadow-xs"
      >
        {(['API', 'SI'] as const).map((option) => {
          const active = value === option
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={cn(
                'min-w-[4.5rem] cursor-pointer rounded-sm px-3 py-1.5 text-sm font-medium transition',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-pressed={active}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Button({
  children,
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const styles = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'border border-input bg-background text-foreground hover:bg-accent',
    danger: 'bg-destructive text-white hover:bg-destructive/90',
  }
  return (
    <button
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-50',
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Card({
  title,
  children,
  className,
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border border-border/80 bg-card p-5 text-card-foreground shadow-sm', className)}>
      {title && <h2 className="mb-4 text-base font-semibold tracking-tight text-foreground">{title}</h2>}
      {children}
    </div>
  )
}
