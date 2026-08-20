import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type AppHeaderState = {
  title?: string
  subtitle?: string
}

type AppHeaderContextValue = {
  header: AppHeaderState
  setHeader: (header: AppHeaderState) => void
}

const AppHeaderContext = createContext<AppHeaderContextValue | null>(null)

export function AppHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<AppHeaderState>({})
  const setHeader = useCallback((next: AppHeaderState) => setHeaderState(next), [])

  const value = useMemo(() => ({ header, setHeader }), [header, setHeader])

  return <AppHeaderContext.Provider value={value}>{children}</AppHeaderContext.Provider>
}

export function useAppHeaderContext() {
  const ctx = useContext(AppHeaderContext)
  if (!ctx) throw new Error('useAppHeaderContext must be used within AppHeaderProvider')
  return ctx
}

export function useAppHeader(title?: string, subtitle?: string) {
  const { setHeader } = useAppHeaderContext()

  useEffect(() => {
    setHeader({ title, subtitle })
    return () => setHeader({})
  }, [title, subtitle, setHeader])
}
