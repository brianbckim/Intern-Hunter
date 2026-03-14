import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import {
  ApiError,
  ensureRecommendations,
  getLatestRecommendations,
  listMyResumes,
  tailorResumeForJob,
  type RecommendationJob,
  type RecommendationsResponse,
  type TailorResumeResponse,
} from '../lib/api'
import './Dashboard.css'

type Job = {
  external_id: string
  title: string
  company?: string
  location?: string
  url?: string
  date_posted?: number
  category?: string
}

const PAGE_SIZE = 20

function formatDate(timestamp?: number): string {
  if (!timestamp) return ''
  return new Date(timestamp * 1000).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
}

function normalizeCategory(category?: string): string {
  if (!category) return ''
  if (category.toLowerCase().includes('software')) return 'Software'
  return category
}

export default function Jobs() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') === 'ai' ? 'ai' : 'internships'
  const [activeTab, setActiveTab] = useState<'ai' | 'internships'>(initialTab)

  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)
  const [recData, setRecData] = useState<RecommendationsResponse | null>(null)
  const [recResumeId, setRecResumeId] = useState<string | null>(null)
  const [recSnapshotId, setRecSnapshotId] = useState<string | null>(null)
  const [recUpdatedAt, setRecUpdatedAt] = useState<string | null>(null)
  const [recRefreshToken, setRecRefreshToken] = useState(0)
  const [tailoringByUid, setTailoringByUid] = useState<Record<string, boolean>>({})
  const [tailoredResumeByUid, setTailoredResumeByUid] = useState<Record<string, TailorResumeResponse>>({})
  const [tailoringErrorByUid, setTailoringErrorByUid] = useState<Record<string, string>>({})
  const [copiedUid, setCopiedUid] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)

  useEffect(() => {
    async function loadJobs() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/jobs/')
        if (!response.ok) {
          throw new Error(`Failed to load jobs (HTTP ${response.status})`)
        }
        const data = (await response.json()) as Job[]
        setJobs(data)
      } catch (errorValue) {
        const message = errorValue instanceof Error ? errorValue.message : 'Failed to load jobs.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    void loadJobs()
  }, [])

  useEffect(() => {
    const tab = searchParams.get('tab') === 'ai' ? 'ai' : 'internships'
    setActiveTab(tab)
  }, [searchParams])

  const categories = useMemo(() => {
    const normalized = jobs.map((job) => normalizeCategory(job.category)).filter(Boolean)
    return Array.from(new Set(normalized)).sort((left, right) => left.localeCompare(right))
  }, [jobs])

  const filteredJobs = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    const result = jobs.filter((job) => {
      const matchesSearch =
        !keyword ||
        job.title?.toLowerCase().includes(keyword) ||
        job.company?.toLowerCase().includes(keyword) ||
        job.location?.toLowerCase().includes(keyword)

      const matchesCategory =
        selectedCategories.length === 0 || selectedCategories.includes(normalizeCategory(job.category))

      return Boolean(matchesSearch && matchesCategory)
    })

    switch (sortBy) {
      case 'oldest':
        result.sort((left, right) => (left.date_posted ?? 0) - (right.date_posted ?? 0))
        break
      case 'company':
        result.sort((left, right) => (left.company ?? '').localeCompare(right.company ?? ''))
        break
      case 'title':
        result.sort((left, right) => (left.title ?? '').localeCompare(right.title ?? ''))
        break
      case 'newest':
      default:
        result.sort((left, right) => (right.date_posted ?? 0) - (left.date_posted ?? 0))
        break
    }

    return result
  }, [jobs, search, selectedCategories, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE))
  const paginatedJobs = filteredJobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [search, selectedCategories, sortBy])

  function toggleCategory(category: string) {
    setSelectedCategories((previous) =>
      previous.includes(category) ? previous.filter((item) => item !== category) : [...previous, category]
    )
  }

  function setTab(next: 'ai' | 'internships') {
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev)
      nextParams.set('tab', next)
      return nextParams
    })
    setActiveTab(next)
  }

  function easternDayKey(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)

    const year = parts.find((p) => p.type === 'year')?.value ?? '0000'
    const month = parts.find((p) => p.type === 'month')?.value ?? '01'
    const day = parts.find((p) => p.type === 'day')?.value ?? '01'
    return `${year}-${month}-${day}`
  }

  useEffect(() => {
    if (activeTab !== 'ai') return
    let cancelled = false
    let lastKey = easternDayKey(new Date())
    const timer = window.setInterval(() => {
      if (cancelled) return
      const currentKey = easternDayKey(new Date())
      if (currentKey !== lastKey) {
        lastKey = currentKey
        setRecRefreshToken((prev) => prev + 1)
      }
    }, 30_000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'ai' || !recResumeId) return
    let cancelled = false
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const latest = await getLatestRecommendations(recResumeId)
          if (cancelled) return
          if (latest.status === 'ready' && latest.data) {
            const snapshotChanged = (latest.snapshot_id && latest.snapshot_id !== recSnapshotId) || false
            const updatedChanged = (latest.updated_at && latest.updated_at !== recUpdatedAt) || false
            if (snapshotChanged || updatedChanged) {
              setRecData(latest.data)
              setRecSnapshotId(latest.snapshot_id)
              setRecUpdatedAt(latest.updated_at)
            }
          }
        } catch {
          // best-effort background sync
        }
      })()
    }, 30_000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeTab, recResumeId, recSnapshotId, recUpdatedAt])

  useEffect(() => {
    let cancelled = false
    let timer: number | null = null

    async function pollLatest(resumeId: string) {
      if (cancelled) return
      try {
        const latest = await getLatestRecommendations(resumeId)
        if (cancelled) return

        if (latest.status === 'ready' && latest.data) {
          setRecData(latest.data)
          setRecResumeId(resumeId)
          setRecSnapshotId(latest.snapshot_id)
          setRecUpdatedAt(latest.updated_at)
          setRecLoading(false)
          return
        }
        if (latest.status === 'error') {
          setRecError(latest.error || 'Failed to generate recommendations.')
          setRecLoading(false)
          return
        }

        setRecLoading(true)
        timer = window.setTimeout(() => void pollLatest(resumeId), 1500)
      } catch (e) {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 401) {
          setRecError('Please login again to load recommendations.')
        } else {
          setRecError(e instanceof Error ? e.message : 'Failed to load recommendations.')
        }
        setRecLoading(false)
      }
    }

    async function ensureAndPoll() {
      if (activeTab !== 'ai') return
      setRecError(null)
      setRecLoading(true)

      try {
        const resumes = await listMyResumes()
        const latestResumeId = resumes[0]?.resume_id ?? null
        if (!latestResumeId) {
          setRecLoading(false)
          setRecError('Upload a resume to get AI recommendations.')
          return
        }

        if (recResumeId && recResumeId !== latestResumeId) {
          setRecData(null)
        }
        setRecResumeId(latestResumeId)

        const ensured = await ensureRecommendations({
          limit: 20,
          candidate_pool: 40,
          use_ai: true,
          resume_id: latestResumeId,
        })
        if (cancelled) return

        if (ensured.status === 'ready' && ensured.data) {
          setRecData(ensured.data)
          setRecSnapshotId(ensured.snapshot_id)
          setRecUpdatedAt(ensured.updated_at)
          setRecLoading(false)
          return
        }

        // pending/missing: keep polling until ready
        void pollLatest(latestResumeId)
      } catch (e) {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 401) {
          setRecError('Please login again to load recommendations.')
        } else {
          setRecError(e instanceof Error ? e.message : 'Failed to load recommendations.')
        }
        setRecLoading(false)
      }
    }

    void ensureAndPoll()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [activeTab, recRefreshToken])

  async function handleTailorResume(job: RecommendationJob) {
    if (!recResumeId) {
      setTailoringErrorByUid((previous) => ({ ...previous, [job.uid]: 'Upload a resume before tailoring.' }))
      return
    }

    setTailoringByUid((previous) => ({ ...previous, [job.uid]: true }))
    setTailoringErrorByUid((previous) => ({ ...previous, [job.uid]: '' }))

    try {
      const value = await tailorResumeForJob({ job_uid: job.uid, resume_id: recResumeId })
      setTailoredResumeByUid((previous) => ({ ...previous, [job.uid]: value }))
    } catch (errorValue) {
      const message = errorValue instanceof Error ? errorValue.message : 'Failed to tailor resume.'
      setTailoringErrorByUid((previous) => ({ ...previous, [job.uid]: message }))
    } finally {
      setTailoringByUid((previous) => ({ ...previous, [job.uid]: false }))
    }
  }

  async function handleCopyTailoredResume(jobUid: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedUid(jobUid)
      window.setTimeout(() => {
        setCopiedUid((current) => (current === jobUid ? null : current))
      }, 1500)
    } catch {
      setTailoringErrorByUid((previous) => ({ ...previous, [jobUid]: 'Failed to copy tailored resume.' }))
    }
  }

  function renderRecommendationJob(job: RecommendationJob) {
    const tailored = tailoredResumeByUid[job.uid]
    const tailoring = tailoringByUid[job.uid] || false
    const tailoringError = tailoringErrorByUid[job.uid]

    return (
      <div key={job.uid} className="ih-card" style={{ marginBottom: 14 }}>
        <div className="ih-cardBody">
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{job.title || 'Untitled role'}</div>
          <div className="ih-muted" style={{ marginBottom: 6 }}>
            {(job.company || 'Unknown company') + ' • ' + (job.location || 'Unknown location')}
          </div>
          {job.reason ? <div className="ih-muted">{job.reason}</div> : null}

          <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="ih-btnPrimary" type="button" disabled={tailoring} onClick={() => void handleTailorResume(job)}>
              {tailoring ? 'Tailoring...' : 'Tailor Resume to JD'}
            </button>
            {job.url ? (
              <a className="ih-btnGhost" href={job.url} target="_blank" rel="noreferrer">
                Apply
              </a>
            ) : null}
          </div>

          {tailoringError ? <div className="ih-error" style={{ marginTop: 12 }}>{tailoringError}</div> : null}

          {tailored ? (
            <div
              style={{
                marginTop: 14,
                border: '1px solid #d1d5db',
                borderRadius: 10,
                padding: 14,
                background: '#fafafa',
                display: 'grid',
                gap: 12,
              }}
            >
              <div style={{ fontWeight: 600 }}>Tailored Resume Draft</div>
              <div className="ih-muted">{tailored.summary}</div>

              {tailored.keywords_to_highlight.length ? (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Keywords to highlight</div>
                  <div className="ih-muted">{tailored.keywords_to_highlight.join(', ')}</div>
                </div>
              ) : null}

              {tailored.targeted_edits.length ? (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Targeted edits</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {tailored.targeted_edits.map((item) => (
                      <li key={item} className="ih-muted" style={{ marginBottom: 4 }}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Draft</div>
                <textarea
                  className="ih-input"
                  value={tailored.tailored_resume}
                  readOnly
                  style={{ minHeight: 260, width: '100%', resize: 'vertical', lineHeight: 1.45 }}
                />
              </div>

              <div>
                <button
                  className="ih-btnGhost"
                  type="button"
                  onClick={() => void handleCopyTailoredResume(job.uid, tailored.tailored_resume)}
                >
                  {copiedUid === job.uid ? 'Copied' : 'Copy Draft'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <AppLayout pageLabel="Jobs" activeNav="jobs">
      <div className="ih-grid">
        <section className="ih-card">
          <div className="ih-cardHeader">
            <div className="ih-cardTitle">Jobs</div>
            <div className="ih-actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className={activeTab === 'ai' ? 'ih-btnPrimary' : 'ih-btnGhost'}
                onClick={() => setTab('ai')}
              >
                AI Recommendations
              </button>
              <button
                type="button"
                className={activeTab === 'internships' ? 'ih-btnPrimary' : 'ih-btnGhost'}
                onClick={() => setTab('internships')}
              >
                Internships
              </button>
            </div>
          </div>

          <div className="ih-cardBody">
            {activeTab === 'ai' ? (
              <>
                {recError ? <p className="ih-error">{recError}</p> : null}

                <div className="ih-row" style={{ marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 22 }}>AI-based recommendations</div>
                    <div className="ih-muted">Recommendations generate automatically based on your latest resume.</div>
                  </div>
                </div>

                {recData?.career_summary ? (
                  <div className="ih-muted" style={{ marginBottom: 14 }}>
                    {recData.career_summary}
                  </div>
                ) : null}

                {recLoading ? <div className="ih-muted">Loading… (AI recommendations are generating)</div> : null}

                {recData?.jobs?.length ? (
                  <>
                    {recData.jobs.slice(0, 20).map((job) => renderRecommendationJob(job))}
                    <div className="ih-muted" style={{ marginTop: 8 }}>
                      {recData.ai_used ? 'Ordered by AI.' : 'Ordered by heuristics (AI not enabled).'}
                    </div>
                  </>
                ) : !recLoading ? (
                  <div className="ih-muted">No recommendations generated yet.</div>
                ) : null}
              </>
            ) : (
              <>
                <div className="ih-muted" style={{ marginBottom: 12 }}>
                  {filteredJobs.length} results
                </div>

                {error ? <p className="ih-error">{error}</p> : null}

                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  <input
                    className="ih-input"
                    placeholder="Search title, company, location..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />

                  <select className="ih-input" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="company">Company A-Z</option>
                    <option value="title">Title A-Z</option>
                  </select>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ marginBottom: 8, fontWeight: 600 }}>Category</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {categories.map((category) => (
                      <label key={category} style={{ fontSize: 14 }}>
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(category)}
                          onChange={() => toggleCategory(category)}
                          style={{ marginRight: 6 }}
                        />
                        {category}
                      </label>
                    ))}
                  </div>
                </div>

                {loading ? <div className="ih-muted">Loading...</div> : null}

                {!loading ? (
                  <>
                    {paginatedJobs.map((job) => (
                      <div
                        key={job.external_id}
                        style={{ border: '1px solid #e5e7eb', padding: 16, marginBottom: 14, borderRadius: 10 }}
                      >
                        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{job.title}</div>
                        <div className="ih-muted" style={{ marginBottom: 6 }}>
                          {job.company || 'Unknown company'} • {job.location || 'Unknown location'}
                        </div>
                        <div className="ih-muted">Posted: {formatDate(job.date_posted) || '—'}</div>

                        {job.url ? (
                          <div style={{ marginTop: 12 }}>
                            <a className="ih-btnGhost" href={job.url} target="_blank" rel="noreferrer">
                              Apply
                            </a>
                          </div>
                        ) : null}
                      </div>
                    ))}

                    <div
                      style={{
                        marginTop: 20,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 16,
                      }}
                    >
                      <button
                        className="ih-btnGhost"
                        disabled={page === 1}
                        onClick={() => setPage((current) => current - 1)}
                      >
                        Previous
                      </button>

                      <span className="ih-muted">
                        Page {page} of {totalPages}
                      </span>

                      <button
                        className="ih-btnGhost"
                        disabled={page === totalPages}
                        onClick={() => setPage((current) => current + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </>
                ) : null}
              </>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  )
}
