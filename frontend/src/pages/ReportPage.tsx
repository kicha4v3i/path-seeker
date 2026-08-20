import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import { api } from '@/lib/api'
import { WellWizardNav } from '@/components/WellWizardNav'
import { Button, Card } from '@/components/ui'

export function ReportPage() {
  const { wellId } = useParams()
  const [reportId, setReportId] = useState<string | null>(null)
  const [filename, setFilename] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generate = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.post<{ report_id?: string; filename?: string; error?: string }>(`/wells/${wellId}/reports`)
      if (res.error) {
        setError(res.error)
      } else {
        setReportId(res.report_id || null)
        setFilename(res.filename || 'report.pdf')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const download = async () => {
    if (!reportId || !wellId) return
    const token = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
      ? (window as unknown as { __clerk_token?: string }).__clerk_token
      : 'dev-token'
    const res = await fetch(
      `${import.meta.env.VITE_API_URL || '/api'}/wells/${wellId}/reports/${reportId}/download`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    )
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <WellWizardNav active="report" />
      <h1 className="text-2xl font-bold">Generate Report</h1>
      <Card>
        <p className="mb-4 text-sm text-text">
          Generate a PDF report containing well details, survey stations, and trajectory summary.
        </p>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={generate} disabled={loading}>
            {loading ? 'Generating...' : 'Generate PDF Report'}
          </Button>
          {reportId && (
            <Button variant="secondary" onClick={download}>
              <Download className="mr-2 inline h-4 w-4" />
              Download {filename}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
