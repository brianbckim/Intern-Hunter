import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import {
  ApiError,
  generateRecommendations,
  listMyResumes,
  type RecommendationJob,
  type RecommendationsResponse,
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
  return new Date(timestamp * 1000).toLocaleDateString()
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

  async function generateAiRecommendations() {
    setRecError(null)
    setRecLoading(true)
    try {
      const resumes = await listMyResumes()
      const latestResumeId = resumes[0]?.resume_id ?? null

      const value = await generateRecommendations({
        limit: 20,
        candidate_pool: 80,
        use_ai: true,
        resume_id: latestResumeId,
      })
      setRecData(value)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setRecError('Please login again to generate recommendations.')
      } else {
        setRecError(e instanceof Error ? e.message : 'Failed to generate recommendations.')
      }
    } finally {
      setRecLoading(false)
    }
  }

  function renderRecommendationJob(job: RecommendationJob) {
    return (
      <div key={job.uid} className="ih-card" style={{ marginBottom: 14 }}>
        <div className="ih-cardBody">
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{job.title || 'Untitled role'}</div>
          <div className="ih-muted" style={{ marginBottom: 6 }}>
            {(job.company || 'Unknown company') + ' • ' + (job.location || 'Unknown location')}
          </div>
          {job.reason ? <div className="ih-muted">{job.reason}</div> : null}

          {job.url ? (
            <div style={{ marginTop: 12 }}>
              <a className="ih-btnGhost" href={job.url} target="_blank" rel="noreferrer">
                Apply
              </a>
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
                    <div className="ih-muted">Click the button to generate the top 20 matches based on your current resume.</div>
                  </div>
                  <div className="ih-actions" style={{ marginTop: 0 }}>
                    <button className="ih-btnPrimary" type="button" disabled={recLoading} onClick={() => void generateAiRecommendations()}>
                      {recLoading ? 'Generating…' : 'Generate'}
                    </button>
                  </div>
                </div>

                {recData?.career_summary ? (
                  <div className="ih-muted" style={{ marginBottom: 14 }}>
                    {recData.career_summary}
                  </div>
                ) : null}

                {recLoading ? <div className="ih-muted">Loading…</div> : null}

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
