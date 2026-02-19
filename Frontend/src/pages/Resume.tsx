import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ApiError,
  downloadResumeFile,
  listMyResumes,
  uploadResume,
  type ResumeListItem,
} from '../lib/api'
import { getAccessToken } from '../lib/auth'
import './Dashboard.css'

type NavItem = { label: string; href: string; active?: boolean }

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/' },
  { label: 'Resume', href: '/resume', active: true },
  { label: 'Jobs', href: '/jobs' },
  { label: 'Applications', href: '/applications' },
  { label: 'Settings', href: '/settings' },
]

function formatDate(isoOrDate: string): string {
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Resume() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [items, setItems] = useState<ResumeListItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const latest = useMemo(() => (items && items.length > 0 ? items[0] : null), [items])

  const refresh = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const list = await listMyResumes()
      setItems(list)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setItems([])
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function onPickFile(file: File) {
    setError(null)
    setUploading(true)
    try {
      await uploadResume(file)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function onDownload(resumeId: string) {
    setError(null)
    try {
      const { blob, filename } = await downloadResumeFile(resumeId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    }
  }

  const token = getAccessToken()

  return (
    <div className="ih-shell">
      <TopBar />
      <div className="ih-body">
        <Sidebar items={navItems} />
        <main className="ih-main">
          <div className="ih-grid">
            <Card title="Resume Upload" subtitle="Upload PDF / DOC and preview status">
              {!token ? (
                <div className="ih-muted">
                  You are not logged in. <Link to="/login">Go to Login</Link>
                </div>
              ) : null}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onPickFile(f)
                  e.currentTarget.value = ''
                }}
              />

              <div className="ih-actions" style={{ marginTop: 0 }}>
                <button
                  className="ih-btnPrimary"
                  disabled={!token || uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? 'Uploading…' : 'Upload PDF / DOC'}
                </button>

                <button
                  className="ih-btnGhost"
                  disabled={!latest}
                  onClick={() => navigate('/')}
                >
                  Analyze Resume
                </button>
              </div>

              <div style={{ marginTop: 12 }}>
                {loading ? (
                  <div className="ih-muted">Loading…</div>
                ) : latest ? (
                  <div>
                    <div className="ih-muted">
                      File: <strong>{latest.original_filename}</strong>
                    </div>
                    <div className="ih-muted">Last updated: {formatDate(latest.uploaded_at)}</div>
                    <div className="ih-actions">
                      <button className="ih-btnGhost" onClick={() => void onDownload(latest.resume_id)}>
                        Download
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ih-muted">No resume uploaded yet.</div>
                )}
              </div>

              {error ? (
                <div className="ih-muted" style={{ marginTop: 10 }}>
                  Error: {error}
                </div>
              ) : null}
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}

function TopBar() {
  return (
    <header className="ih-topbar">
      <div className="ih-brand">
        <div className="ih-logo">IH</div>
        <div>
          <div className="ih-brandName">InternHunter</div>
          <div className="ih-muted">Resume</div>
        </div>
      </div>

      <div className="ih-topActions">
        <Link className="ih-btnGhost" to="/">
          Dashboard
        </Link>
      </div>
    </header>
  )
}

function Sidebar({ items }: { items: NavItem[] }) {
  return (
    <aside className="ih-sidebar">
      <nav className="ih-nav">
        {items.map((item) => (
          <Link
            key={item.label}
            to={item.href}
            className={`ih-navItem ${item.active ? 'active' : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ih-sidebarFooter">
        <div className="ih-muted">Tip</div>
        <div className="ih-sidebarTip">Upload your latest resume before requesting AI feedback.</div>
      </div>
    </aside>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="ih-card">
      <div className="ih-cardHeader">
        <div>
          <div className="ih-cardTitle">{title}</div>
          {subtitle ? <div className="ih-muted">{subtitle}</div> : null}
        </div>
      </div>
      <div className="ih-cardBody">{children}</div>
    </section>
  )
}
