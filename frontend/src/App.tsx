import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { ProjectFormPage } from '@/pages/ProjectFormPage'
import { ProjectDetailPage } from '@/pages/ProjectDetailPage'
import { SubsurfacePage } from '@/pages/SubsurfacePage'
import { TrajectoryPage } from '@/pages/TrajectoryPage'
import { ReportPage } from '@/pages/ReportPage'
import { SettingsPage } from '@/pages/SettingsPage'

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/new" element={<ProjectFormPage />} />
          <Route path="projects/:projectId/edit" element={<ProjectFormPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          <Route
            path="projects/:projectId/wells/new"
            element={<Navigate to="../.." relative="path" replace />}
          />
          <Route
            path="projects/:projectId/wells/:wellId/well"
            element={<Navigate to="../subsurface" relative="path" replace />}
          />
          <Route path="projects/:projectId/wells/:wellId/subsurface" element={<SubsurfacePage />} />
          <Route path="projects/:projectId/wells/:wellId/trajectory" element={<TrajectoryPage />} />
          <Route path="projects/:projectId/wells/:wellId/report" element={<ReportPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  if (clerkKey) {
    return (
      <ClerkProvider publishableKey={clerkKey}>
        <AppRoutes />
      </ClerkProvider>
    )
  }
  return <AppRoutes />
}
