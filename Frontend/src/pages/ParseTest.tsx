import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, getResume, listMyResumes, uploadResume, type ResumeDetail } from '../lib/api'
import { getAccessToken } from '../lib/auth'
import './Dashboard.css'

function formatDate(isoOrDate: string | null | undefined): string {
  if (!isoOrDate) return '—'
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ParseTest() {
  const token = getAccessToken()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [detail, setDetail] = useState<ResumeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadLatest = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const items = await listMyResumes()
      const latestId = items[0]?.resume_id
      if (!latestId) {
        setDetail(null)
        return
      }
      const d = await getResume(latestId)
      setDetail(d)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setDetail(null)
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load latest resume')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLatest()
  }, [loadLatest])

  const extractedText = detail?.extracted_text ?? null
  const extractedLen = useMemo(() => (extractedText ? extractedText.length : 0), [extractedText])

  async function onPickFile(file: File) {
    setError(null)
    setUploading(true)
    try {
      const res = await uploadResume(file)

      // Show uploaded result immediately (already fetched from backend).
      setDetail({
        resume_id: res.resume_id,
        original_filename: res.resume.original_filename,
        content_type: res.resume.content_type,
        storage_ref: res.resume.storage_ref,
        extracted_text: res.resume.extracted_text,
        uploaded_at: res.resume.uploaded_at,
        analyzed_at: res.resume.analyzed_at,
      })

      // Then refresh from backend's latest view.
      await loadLatest()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="ih-shell">
      <header className="ih-topbar">
        <div className="ih-brand">
          <div className="ih-logo">IH</div>
          <div>
            <div className="ih-brandName">InternHunter</div>
            <div className="ih-muted">Parse Test</div>
          </div>
        </div>

        <div className="ih-topActions">
          <Link className="ih-btnGhost" to="/">
            Dashboard
          </Link>
          <Link className="ih-btnGhost" to="/resume">
            Resume
          </Link>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24, width: '100%' }}>
        <div className="ih-grid">
          <Card title="Resume Extraction Viewer" subtitle="Shows extracted_text from backend (Issue #6)">
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
              <button className="ih-btnPrimary" disabled={!token || uploading} onClick={() => fileInputRef.current?.click()}>
                {uploading ? 'Uploading…' : 'Upload PDF/DOCX'}
              </button>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              {loading ? <div className="ih-muted">Loading latest…</div> : null}

              <div className="ih-muted">
                file: <strong>{detail?.original_filename ?? '—'}</strong> · uploaded_at:{' '}
                <strong>{formatDate(detail?.uploaded_at)}</strong> · analyzed_at:{' '}
                <strong>{formatDate(detail?.analyzed_at)}</strong> · extracted_text length:{' '}
                <strong>{extractedLen}</strong>
              </div>

              {extractedText ? (
                <textarea
                  className="ih-input"
                  value={extractedText}
                  readOnly
                  rows={18}
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
                />
              ) : (
                <div className="ih-muted">No extracted_text found for the selected resume.</div>
              )}

              {error ? <div className="ih-muted">Error: {error}</div> : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
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
