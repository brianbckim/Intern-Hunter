import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { ApiError, deleteMyApplication, listMyApplications, type JobApplicationRecord } from '../lib/api'
import './Dashboard.css'

function formatAppliedDate(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  })
}

function formatStatusLabel(status: string): string {
  if (!status) return '—'
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')
}

function rowMatchesQuery(row: JobApplicationRecord, q: string): boolean {
  if (!q.trim()) return true
  const needle = q.trim().toLowerCase()
  const hay = [
    row.job_title,
    row.job_company,
    row.job_location,
    row.status,
    row.job_url,
    row.job_source,
    row.job_external_id,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(needle)
}

export default function Applications() {
  const [rows, setRows] = useState<JobApplicationRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const list = await listMyApplications()
      setRows(list)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError('Please sign in again.')
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load applications.')
      }
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filteredRows = useMemo(() => {
    if (!rows) return []
    return rows.filter((row) => rowMatchesQuery(row, search))
  }, [rows, search])

  async function handleDelete(row: JobApplicationRecord): Promise<void> {
    if (!row.application_id) return
    const ok = window.confirm(`Remove “${row.job_title || 'this application'}” from your list?`)
    if (!ok) return
    setDeletingId(row.application_id)
    setError(null)
    try {
      await deleteMyApplication(row.application_id)
      setRows((prev) => (prev ? prev.filter((r) => r.application_id !== row.application_id) : prev))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <AppLayout pageLabel="Applications" activeNav="applications">
      <div className="ih-grid">
        <section className="ih-card">
          <div className="ih-cardHeader">
            <div className="ih-cardTitle">Applications</div>
            <div className="ih-muted" style={{ marginTop: 8 }}>
              Roles you marked as applied from the Jobs page.
            </div>
          </div>
          <div className="ih-cardBody">
            <div className="ih-appToolbar">
              <input
                className="ih-input ih-appSearch"
                type="search"
                placeholder="Search title, company, location, status…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search applications"
              />
              <button className="ih-btnGhost" type="button" disabled={loading} onClick={() => void refresh()}>
                Refresh
              </button>
              <Link className="ih-btnGhost" to="/jobs" style={{ textDecoration: 'none', display: 'inline-block' }}>
                Browse jobs
              </Link>
            </div>

            {error ? <p className="ih-error">{error}</p> : null}
            {loading ? <div className="ih-muted">Loading…</div> : null}

            {!loading && rows && rows.length === 0 && !error ? (
              <div className="ih-muted">
                No applications yet. Open <Link to="/jobs">Jobs</Link>, click Apply on a role, then confirm with “Yes,
                Applied” when you return.
              </div>
            ) : null}

            {!loading && rows && rows.length > 0 && filteredRows.length === 0 ? (
              <div className="ih-muted">No matches for “{search}”. Clear the search to see all applications.</div>
            ) : null}

            {!loading && rows && rows.length > 0 && filteredRows.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="ih-appTable">
                  <thead>
                    <tr>
                      <th>Job title</th>
                      <th>Company</th>
                      <th>Location</th>
                      <th>Date applied</th>
                      <th>Status</th>
                      <th>Link</th>
                      <th>Manage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={`${row.job_source}-${row.job_external_id}-${row.application_id}`}>
                        <td>{row.job_title || '—'}</td>
                        <td>{row.job_company || '—'}</td>
                        <td>{row.job_location || '—'}</td>
                        <td>{formatAppliedDate(row.created_at || row.updated_at)}</td>
                        <td>
                          <span className="ih-appStatus">{formatStatusLabel(row.status)}</span>
                        </td>
                        <td>
                          {row.job_url ? (
                            <a
                              className="ih-appLinkBtn"
                              href={row.job_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <button
                            className="ih-appDeleteBtn"
                            type="button"
                            disabled={deletingId === row.application_id}
                            onClick={() => void handleDelete(row)}
                          >
                            {deletingId === row.application_id ? 'Removing…' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AppLayout>
  )
}
