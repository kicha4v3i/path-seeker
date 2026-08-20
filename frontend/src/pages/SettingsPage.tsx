import { useEffect, useState } from 'react'
import { api, docId } from '@/lib/api'
import { Button, Card, InputField, SelectField } from '@/components/ui'

type User = {
  email: string
  name: string
  default_unit_system: string
  display_unit_override?: string | null
}

export function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [projects, setProjects] = useState<{ _id?: string; id?: string; name: string }[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [members, setMembers] = useState<{ email: string; role: string }[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get<User>('/me').then(setUser)
    api.get<{ _id?: string; id?: string; name: string }[]>('/projects').then(setProjects)
  }, [])

  useEffect(() => {
    if (selectedProject) {
      api.get<{ email: string; role: string }[]>(`/projects/${selectedProject}/members`).then(setMembers)
    }
  }, [selectedProject])

  const saveSettings = async () => {
    if (!user) return
    await api.patch('/me/settings', {
      default_unit_system: user.default_unit_system,
      display_unit_override: user.display_unit_override,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const invite = async () => {
    if (!selectedProject || !inviteEmail) return
    await api.post(`/projects/${selectedProject}/members`, { email: inviteEmail, role: inviteRole })
    setInviteEmail('')
    api.get<{ email: string; role: string }[]>(`/projects/${selectedProject}/members`).then(setMembers)
  }

  if (!user) return <p>Loading...</p>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card title="Profile">
        <p className="text-sm text-text">{user.name || user.email}</p>
        <p className="text-xs text-text-muted">{user.email}</p>
      </Card>

      <Card title="Units">
        <div className="grid gap-3">
          <SelectField label="Default Unit System" options={['API', 'SI']} value={user.default_unit_system} onChange={(e) => setUser({ ...user, default_unit_system: e.target.value })} />
          <SelectField label="Display Override" options={['', 'API', 'SI']} value={user.display_unit_override || ''} onChange={(e) => setUser({ ...user, display_unit_override: e.target.value || null })} />
          <Button onClick={saveSettings}>Save Settings</Button>
          {saved && <p className="text-sm text-green-600">Saved.</p>}
        </div>
      </Card>

      <Card title="Project Sharing">
        <div className="grid gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-text">Project</span>
            <select
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="">Select project...</option>
              {projects.map((p) => (
                <option key={docId(p)} value={docId(p)}>{p.name}</option>
              ))}
            </select>
          </label>
          <InputField label="Invite Email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <SelectField label="Role" options={['viewer', 'editor', 'owner']} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} />
          <Button onClick={invite}>Invite Member</Button>
          {members.length > 0 && (
            <ul className="text-sm text-text">
              {members.map((m, i) => (
                <li key={i}>{m.email} — {m.role}</li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}
